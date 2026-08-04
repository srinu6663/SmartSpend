/**
 * Keeps the Supabase project from auto-pausing while the app is open.
 *
 * Free-tier projects pause after ~7 consecutive days with no requests. A single
 * cheap request resets that clock, so this pings `/auth/v1/health` periodically.
 *
 * Two problems this is built to avoid:
 *
 *  1. **Duplicate pingers.** A naive setInterval in a component gives you one
 *     timer per mount, per tab — ten tabs open overnight means ten timers
 *     hammering the endpoint forever, and React StrictMode/HMR double them
 *     again. So: a module-level singleton guard, plus a localStorage lease so
 *     only ONE tab across the whole browser is the pinger. The lease expires,
 *     so closing the leader tab lets another take over instead of leaving the
 *     job orphaned.
 *
 *  2. **Overlapping pings.** A ping that hangs must not have a second one piled
 *     on top of it. An in-flight flag makes each tick a no-op while one is
 *     pending.
 *
 * This only covers "while someone has the app open". The project can still
 * pause during a quiet week with no visitors — that is what the scheduled
 * workflow in .github/workflows/supabase-keepalive.yml is for.
 */

const LEASE_KEY = "finly-keepalive-lease";
/** How often the leader pings. Well under the ~7 day pause window. */
const PING_INTERVAL_MS = 10 * 60 * 1000;
/** Leader re-checks/renews this often. */
const LEASE_RENEW_MS = 30 * 1000;
/** A lease older than this is considered abandoned (tab closed/crashed). */
const LEASE_TTL_MS = 90 * 1000;
const PING_TIMEOUT_MS = 10 * 1000;

const TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

interface Lease {
  owner: string;
  expiresAt: number;
}

function readLease(): Lease | null {
  try {
    const raw = localStorage.getItem(LEASE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Lease;
    return typeof parsed?.owner === "string" && typeof parsed?.expiresAt === "number" ? parsed : null;
  } catch {
    return null; // corrupt or storage blocked — treat as no lease
  }
}

function writeLease(): boolean {
  try {
    localStorage.setItem(LEASE_KEY, JSON.stringify({ owner: TAB_ID, expiresAt: Date.now() + LEASE_TTL_MS }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort leader election. localStorage has no compare-and-swap, so two
 * tabs racing on an expired lease can both briefly claim it; the re-read below
 * settles it within a tick. Worst case is one extra health ping, which is
 * harmless — this is a keep-alive, not a mutual-exclusion problem.
 */
function tryBecomeLeader(): boolean {
  const lease = readLease();
  const now = Date.now();

  if (lease && lease.owner !== TAB_ID && lease.expiresAt > now) return false;
  if (!writeLease()) return false;

  return readLease()?.owner === TAB_ID;
}

function releaseLease(): void {
  try {
    if (readLease()?.owner === TAB_ID) localStorage.removeItem(LEASE_KEY);
  } catch {
    /* nothing we can do */
  }
}

/** Guard against duplicate starts surviving HMR and StrictMode double-effects. */
const globalScope = globalThis as typeof globalThis & { __finlyKeepAlive?: () => void };

export interface KeepAliveOptions {
  url: string;
  apiKey: string;
  intervalMs?: number;
  onPing?: (ok: boolean, detail: string) => void;
}

/**
 * Starts the keep-alive. Idempotent: calling it again stops the previous
 * instance first, so there is never more than one timer set per tab.
 * Returns a stop function.
 */
export function startKeepAlive({ url, apiKey, intervalMs = PING_INTERVAL_MS, onPing }: KeepAliveOptions): () => void {
  if (typeof window === "undefined") return () => undefined;

  // Tear down any previous instance (HMR reload, re-mount, repeat call).
  globalScope.__finlyKeepAlive?.();

  let stopped = false;
  let pinging = false;
  let isLeader = false;
  let lastPingAt = 0;

  const ping = async (): Promise<void> => {
    if (stopped || pinging) return; // no overlapping pings, ever
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    pinging = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    try {
      const res = await fetch(`${url}/auth/v1/health`, {
        method: "GET",
        headers: { apikey: apiKey },
        cache: "no-store",
        signal: controller.signal,
      });
      lastPingAt = Date.now();
      onPing?.(res.ok, `HTTP ${res.status}`);
    } catch (error) {
      onPing?.(false, error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timer);
      pinging = false;
    }
  };

  const tick = (): void => {
    if (stopped) return;

    isLeader = tryBecomeLeader();
    if (!isLeader) return; // another tab owns this job

    if (Date.now() - lastPingAt >= intervalMs) void ping();
  };

  // One interval, not one per concern: the lease renewal cadence drives
  // everything and the ping is rate-limited by lastPingAt.
  const interval = setInterval(tick, LEASE_RENEW_MS);
  tick();

  const onVisible = (): void => {
    if (document.visibilityState === "visible") tick();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", tick);

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", tick);
    if (isLeader) releaseLease(); // let another tab take over promptly
    if (globalScope.__finlyKeepAlive === stop) delete globalScope.__finlyKeepAlive;
  };

  globalScope.__finlyKeepAlive = stop;
  window.addEventListener("pagehide", stop, { once: true });

  return stop;
}
