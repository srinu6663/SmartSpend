import { supabase } from "@/lib/supabase";

/**
 * Client side of the AI features. Every model call goes through the `ai` Edge
 * Function — the Gemini key is server-side only and never reaches the browser.
 */

export interface ReceiptItem {
  name: string;
  amount: number | null;
}

export interface ReceiptScan {
  amount: number | null;
  merchant: string | null;
  date: string | null;
  type: "expense" | "income" | null;
  category: string | null;
  currency: string | null;
  /** 0-1 confidence in the extracted amount. Below 0.5 the UI asks for confirmation. */
  confidence: number;
  items: ReceiptItem[] | null;
}

export interface Insight {
  text: string;
  trend: "up" | "down" | "flat";
  severity: "good" | "info" | "warning";
  category: string | null;
}

export interface SpendingStats {
  periodDays: number;
  totalIncome: number;
  totalExpense: number;
  transactionCount: number;
  topCategories: Array<{ name: string; amount: number; share: number }>;
  byWeek: Array<{ week: string; expense: number }>;
  budgets: Array<{ category: string; limit: number; spent: number }>;
  recurringCount: number;
}

/** Longest edge of an uploaded receipt after downscaling. */
const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.82;

export class AIError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "AIError";
  }
}

/**
 * Downscales and re-encodes an image before upload.
 *
 * A modern phone camera produces 3-6 MB / 12 MP JPEGs. Sending those raw is slow
 * on mobile data, costs more tokens, and can exceed the function's size cap —
 * while adding nothing, since receipt text is legible well below 1600px.
 * Falls back to the original file if canvas encoding is unavailable.
 */
export async function compressImage(file: File): Promise<{ base64: string; mimeType: string; blob: Blob }> {
  const original = async (): Promise<{ base64: string; mimeType: string; blob: Blob }> => ({
    base64: await toBase64(file),
    mimeType: file.type || "image/jpeg",
    blob: file,
  });

  // HEIC/HEIF can't be decoded by canvas in most browsers — send as-is.
  if (/heic|heif/i.test(file.type)) return original();

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));

    // Already small enough — re-encoding would only lose quality.
    if (scale === 1 && file.size < 900_000) {
      bitmap.close();
      return original();
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return original();
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob) return original();

    return { base64: await toBase64(blob), mimeType: "image/jpeg", blob };
  } catch {
    return original(); // decode failed — let the server try the raw file
  }
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(blob);
  });
}

async function invokeAI<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ai", { body });

  if (error) {
    // FunctionsHttpError carries the response; surface the server's message.
    const response = (error as { context?: Response }).context;
    if (response && typeof response.json === "function") {
      try {
        const parsed = await response.clone().json();
        if (parsed?.error) throw new AIError(parsed.error, response.status);
      } catch (e) {
        if (e instanceof AIError) throw e;
      }
      throw new AIError("AI request failed.", response.status);
    }
    throw new AIError(error.message || "AI request failed.");
  }

  if (data?.error) throw new AIError(data.error);
  return data as T;
}

export function scanReceipt(base64: string, mimeType: string): Promise<ReceiptScan> {
  return invokeAI<ReceiptScan>({ action: "scan-receipt", image: base64, mimeType });
}

/* ── Conversational assistant ──────────────────────────────────────────────── */

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatFacts {
  range: { from: string; to: string };
  metric: "expense" | "income" | "net" | "count";
  totalExpense: number;
  totalIncome: number;
  net: number;
  transactionCount: number;
  value: number;
  groups: Array<{ label: string; amount: number; count: number; share: number }>;
  comparison: { range: { from: string; to: string }; value: number; change: number; changePercent: number | null } | null;
  empty: boolean;
}

export interface ChatReply {
  answer: string;
  facts: ChatFacts | null;
  offTopic: boolean;
}

/**
 * Asks a question about the user's own finances.
 *
 * The server resolves the question to a query plan, computes the figures from the
 * user's rows (RLS-scoped by their JWT), and only then asks the model to word the
 * answer — so quoted numbers are computed, never generated.
 */
export function askAI(question: string, history: ChatTurn[] = []): Promise<ChatReply> {
  return invokeAI<ChatReply>({
    action: "chat",
    question,
    // Trim to recent turns: enough for follow-ups, bounded for cost.
    history: history.slice(-10).map((t) => ({ role: t.role, content: t.content })),
  });
}

/* ── Insights, with caching ────────────────────────────────────────────────── */

const CACHE_KEY = "finly-insights-cache";
/** Insights are a summary of weeks of data — regenerating per mount is waste. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface CachedInsights {
  fingerprint: string;
  at: number;
  insights: Insight[];
}

/** Cheap stable hash of the stats, so new transactions invalidate the cache. */
function fingerprint(stats: SpendingStats): string {
  const str = JSON.stringify(stats);
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

function readCache(fp: string): Insight[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedInsights;
    const fresh = Date.now() - cached.at < CACHE_TTL_MS;
    return cached.fingerprint === fp && fresh && Array.isArray(cached.insights) ? cached.insights : null;
  } catch {
    return null;
  }
}

function writeCache(fp: string, insights: Insight[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fingerprint: fp, at: Date.now(), insights }));
  } catch {
    /* quota or private mode — caching is optional */
  }
}

export function clearInsightsCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* nothing to do */
  }
}

/**
 * Returns insights for the given stats, from cache when the data hasn't changed.
 * Pass `force` for an explicit user-initiated refresh.
 */
export async function getInsights(stats: SpendingStats, force = false): Promise<Insight[]> {
  const fp = fingerprint(stats);

  if (!force) {
    const cached = readCache(fp);
    if (cached) return cached;
  }

  const { insights } = await invokeAI<{ insights: Insight[] }>({ action: "insights", stats });
  writeCache(fp, insights);
  return insights;
}
