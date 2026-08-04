import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ConcurrencyLimiter, SingleFlight, abortPromise } from "@/lib/requestPool";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Set when the env vars are missing/malformed. The app renders a config error
 * screen instead of booting a client pointed at a fake host (which used to make
 * every request fail with an unexplained "Failed to fetch").
 */
export const supabaseConfigError: string | null = (() => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing. Copy .env.example to .env.local and fill them in.";
  }
  try {
    const { protocol } = new URL(supabaseUrl);
    if (protocol !== "https:" && protocol !== "http:") throw new Error("bad protocol");
  } catch {
    return `VITE_SUPABASE_URL is not a valid URL: "${supabaseUrl}"`;
  }
  return null;
})();

if (supabaseConfigError) console.error("[supabase]", supabaseConfigError);

/** Per-request ceiling. A hung socket must never turn into a hung UI. */
const REQUEST_TIMEOUT_MS = 20_000;
/** Extra attempts for retryable *reads* (cold starts, brief 5xx, dropped sockets). */
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 600;
/** 540 is what Supabase's edge returns for a paused/unavailable project. */
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504, 540]);
/**
 * Ceiling on simultaneous requests — the pool. Browsers cap ~6 per host anyway;
 * queueing above the client makes the limit explicit and keeps a focus-triggered
 * hydration burst from starving interactive requests.
 */
const MAX_CONCURRENT_REQUESTS = 6;

const limiter = new ConcurrencyLimiter(MAX_CONCURRENT_REQUESTS);
const inflightReads = new SingleFlight<Response>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Snapshot of pool state, for debugging (`window.__finlyPool()` in dev). */
export const poolStats = () => ({ ...limiter.stats, dedupedReads: inflightReads.size });

/**
 * PostgREST answers `404 PGRST205` while its schema cache is cold — which is
 * exactly what a just-resumed project does for the first minute. Retrying that
 * turns a hard failure into a short delay. Verified against a live resume:
 * 404 PGRST205 → 503 → 200 over ~75 seconds.
 */
async function isColdSchemaCache(response: Response): Promise<boolean> {
  if (response.status !== 404) return false;
  try {
    const body = await response.clone().json();
    return body?.code === "PGRST205";
  } catch {
    return false; // not JSON — a genuine 404
  }
}

function linkSignals(external: AbortSignal | null | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs);

  const forward = () => controller.abort(external?.reason);
  if (external) {
    if (external.aborted) forward();
    else external.addEventListener("abort", forward, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      external?.removeEventListener("abort", forward);
    },
  };
}

/**
 * The actual attempt loop: hard timeout per try, bounded retry with backoff.
 *
 * Retries are limited to reads on purpose: a write whose response was lost may
 * well have been applied server-side, so replaying it could duplicate a
 * transaction. Writes fail fast and surface a real error instead.
 */
async function attemptFetch(
  input: RequestInfo | URL,
  init: RequestInit,
  externalSignal: AbortSignal | null | undefined,
  retryable: boolean
): Promise<Response> {
  const attempts = retryable ? MAX_RETRIES + 1 : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const { signal, cleanup } = linkSignals(externalSignal, REQUEST_TIMEOUT_MS);
    const release = await limiter.acquire(); // wait for a pool slot
    try {
      const response = await fetch(input, { ...init, signal });
      const isLast = attempt === attempts - 1;

      if (!isLast && (RETRYABLE_STATUS.has(response.status) || (await isColdSchemaCache(response)))) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;

      // Caller cancelled (component unmounted, etc.) — never retry that.
      if (externalSignal?.aborted) throw error;
      if (attempt === attempts - 1) break;

      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    } finally {
      release();
      cleanup();
    }
  }

  throw lastError;
}

/** Cache key for read deduplication. Auth token matters: different user, different result. */
function readKey(input: RequestInfo | URL, init: RequestInit): string {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const headers = new Headers(init.headers ?? {});
  return `${(init.method ?? "GET").toUpperCase()} ${url} ${headers.get("Authorization") ?? ""}`;
}

/**
 * Pooled, deduplicated, timeout-bounded fetch — the transport for every
 * Supabase call in the app.
 *
 * Concurrent identical reads collapse into one network request. The shared
 * request is intentionally NOT bound to any single caller's AbortSignal: one
 * component unmounting must not cancel a request its siblings are awaiting.
 * Each caller instead races its own signal against the shared promise, so
 * cancellation stays per-caller.
 */
async function resilientFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const retryable = method === "GET" || method === "HEAD";
  const external = init.signal;

  if (!retryable) {
    return attemptFetch(input, init, external, false);
  }

  const shared = inflightReads.run(readKey(input, init), () =>
    attemptFetch(input, { ...init, signal: undefined }, undefined, true)
  );

  const response = external
    ? await Promise.race([shared, abortPromise(external)])
    : await shared;

  // Each caller gets its own body stream; the shared original is never read.
  return response.clone();
}

/**
 * One client per page, guaranteed.
 *
 * Every createClient() call spins up its own GoTrueClient with its own token
 * refresh timer and its own storage listener. Vite HMR re-evaluates this module
 * on save, so without a cache you accumulate zombie clients that all refresh the
 * same session concurrently — they race, and a loser can overwrite good tokens
 * with a stale rotation, silently logging the user out. (This is the cause of
 * the "Multiple GoTrueClient instances detected" console warning.)
 */
const clientCache = globalThis as typeof globalThis & { __finlySupabase?: SupabaseClient };

export const supabase: SupabaseClient =
  clientCache.__finlySupabase ??
  createClient(supabaseUrl ?? "https://invalid.local", supabaseAnonKey ?? "invalid", {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storageKey: "finly-auth",
    },
    global: {
      fetch: resilientFetch,
      headers: { "x-client-info": "finly-web" },
    },
    db: { schema: "public" },
    realtime: { params: { eventsPerSecond: 5 } },
  });

clientCache.__finlySupabase = supabase;

/** Raw config, for callers that need plain HTTP (health probes, keep-alive). */
export const SUPABASE_URL = supabaseUrl ?? "";
export const SUPABASE_ANON_KEY = supabaseAnonKey ?? "";

if (import.meta.env.DEV) {
  (globalThis as typeof globalThis & { __finlyPool?: typeof poolStats }).__finlyPool = poolStats;
}

export type BackendStatus = "ok" | "offline" | "unreachable" | "misconfigured";

export interface BackendProbe {
  status: BackendStatus;
  message: string;
  detail?: string;
}

/**
 * Cheap unauthenticated probe of the auth service. Used to tell "backend is
 * down / project paused" apart from "your password was wrong", so the UI can
 * say something true instead of spinning.
 */
export async function probeBackend(timeoutMs = 8_000): Promise<BackendProbe> {
  if (supabaseConfigError) {
    return { status: "misconfigured", message: "Supabase is not configured.", detail: supabaseConfigError };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { status: "offline", message: "You appear to be offline. Check your connection and retry." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Bypass resilientFetch: this probe wants a single fast verdict, not retries.
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      method: "GET",
      headers: { apikey: supabaseAnonKey as string },
      signal: controller.signal,
    });

    if (res.ok) return { status: "ok", message: "Connected." };

    return {
      status: "unreachable",
      message:
        res.status === 540
          ? "The Supabase project is paused. Resume it from the Supabase dashboard."
          : "The Supabase backend responded with an error.",
      detail: `HTTP ${res.status} ${res.statusText}`,
    };
  } catch (error) {
    return {
      status: "unreachable",
      message:
        "Can't reach the Supabase backend. The project is most likely paused (free projects pause after ~7 days idle) or the URL is wrong.",
      detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** True for failures that are transport-level rather than "the API said no". */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof TypeError) return true; // "Failed to fetch"
  if (error instanceof DOMException) return error.name === "TimeoutError" || error.name === "AbortError";
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|network ?error|load failed|timed out|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION/i.test(message);
}

/** Turns raw client/auth errors into something worth showing a user. */
export function describeError(error: unknown, fallback = "Something went wrong."): string {
  if (supabaseConfigError) return supabaseConfigError;
  if (isNetworkError(error)) {
    return typeof navigator !== "undefined" && navigator.onLine === false
      ? "You're offline. Reconnect and try again."
      : "Can't reach the server right now. The Supabase project may be paused — resume it and retry.";
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Drops locally cached auth state after an unrecoverable refresh failure. */
export function clearStoredSession(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k === "finly-auth" || k.startsWith("sb-"))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage unavailable (private mode) — nothing to clear */
  }
}
