// @ts-nocheck
// Supabase Edge Function — runs on Deno runtime, not Node.js
// Deploy: supabase functions deploy ai
// Secret:  supabase secrets set GEMINI_API_KEY=...
//
// WHY THIS EXISTS
// Gemini used to be called straight from the browser with VITE_GEMINI_API_KEY,
// which ships the key to every visitor — anyone could read it out of the bundle
// and spend the quota. All model access now happens here, where the key stays
// server-side and every call is tied to an authenticated user.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  sanitizeSpec,
  computeFacts,
  resolveRange,
  dateStr,
  type Facts,
  type TransactionRow,
} from "./queryPlan.ts";

const RAW_GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");

/**
 * Normalises the key before use.
 *
 * Secrets set from a shell or an env file routinely arrive with a trailing
 * newline or wrapping quotes ("supabase secrets set K=\"AIza...\""). The key goes
 * into a URL query parameter, so a single stray character makes Gemini reply
 * "API key not valid" — indistinguishable from a genuinely wrong key, and a
 * miserable thing to debug. Strip the usual accidents rather than trusting the
 * value verbatim.
 */
const GEMINI_API_KEY = normaliseKey(RAW_GEMINI_KEY);

/**
 * A key is only ever [A-Za-z0-9._-], so strip anything else from either end.
 *
 * Stripping just straight quotes was not enough: a value pasted from a document
 * or chat window arrives wrapped in CURLY quotes ("…"), which are neither
 * whitespace nor a straight quote, so they survived and Gemini replied
 * "API key not valid" with no hint as to why.
 */
function normaliseKey(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return raw.replace(/^[^A-Za-z0-9]+/, "").replace(/[^A-Za-z0-9._-]+$/, "");
}

/**
 * Google issues Gemini keys in more than one format — the long-standing
 * "AIza" + 35 chars, and a newer AI Studio format prefixed "AQ.". Both are
 * valid, so this only rejects values that are obviously not a key at all
 * (empty, or far too short). Asserting a single format previously flagged a
 * perfectly good key as malformed, which sent debugging down the wrong path.
 */
const GEMINI_KEY_SHAPES = [/^AIza[0-9A-Za-z_-]{35}$/, /^AQ\.[0-9A-Za-z._-]{20,}$/];
const looksLikeKey = (k: string) => GEMINI_KEY_SHAPES.some((re) => re.test(k));

/**
 * Non-sensitive description of the configured key, for diagnostics.
 * Reports length and shape only — never any part of the value itself.
 */
function describeKeyShape(): string {
  if (!RAW_GEMINI_KEY) return "GEMINI_API_KEY is not set";
  const key = GEMINI_API_KEY ?? "";
  const trimmedDiff = RAW_GEMINI_KEY.length - key.length;
  // Characters left INSIDE the value that can't be part of a key — a space or
  // line break mid-string means the paste itself was broken, which no amount of
  // end-trimming can repair.
  const innerJunk = (key.match(/[^A-Za-z0-9._-]/g) ?? []).length;
  return [
    `length=${key.length}`,
    `recognisedKeyFormat=${looksLikeKey(key)}`,
    trimmedDiff > 0 ? `strippedChars=${trimmedDiff} (stray wrapper characters removed)` : "strippedChars=0",
    innerJunk > 0 ? `invalidCharsInside=${innerJunk}` : "invalidCharsInside=0",
  ].join(", ");
}

if (GEMINI_API_KEY && !looksLikeKey(GEMINI_API_KEY)) {
  console.error(`GEMINI_API_KEY is not in a recognised format — ${describeKeyShape()}`);
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/** Base64 payload ceiling (~8 MB of image). Guards cost and request size. */
const MAX_IMAGE_BASE64_BYTES = 8 * 1024 * 1024;
const GEMINI_TIMEOUT_MS = 45_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

/**
 * Best-effort per-user throttle.
 *
 * This is per-isolate, so it is a speed bump rather than a guarantee — Supabase
 * may run several isolates concurrently and recycles them when idle. It exists
 * to stop a runaway client loop from burning quota. A hard limit would need a
 * counter table; see the `ai_usage` note in supabase/migrations.
 */
const RATE_LIMIT = { windowMs: 60_000, max: 20 };
const hits = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(userId, recent);

  if (hits.size > 500) hits.clear(); // crude bound on memory growth
  return recent.length > RATE_LIMIT.max;
}

/** Resolves the caller's user from their JWT. Returns null when not authenticated. */
async function getUser(req: Request): Promise<{ id: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: SUPABASE_ANON_KEY as string },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.id ? { id: user.id } : null;
  } catch {
    return null;
  }
}

async function callGemini(body: unknown): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await res.json();
    if (!res.ok) {
      const message = data?.error?.message ?? `Gemini returned HTTP ${res.status}`;
      throw new Error(`Gemini HTTP ${res.status}: ${message}`);
    }

    // 2.5 models can emit several parts; take the first with actual text rather
    // than assuming parts[0] is it.
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts)
      ? parts.map((p: Record<string, unknown>) => p?.text).find((t: unknown) => typeof t === "string" && t.length > 0)
      : undefined;

    if (!text) {
      const reason = data?.candidates?.[0]?.finishReason ?? "no content";
      const blocked = data?.promptFeedback?.blockReason;
      throw new Error(
        `Model returned no usable output (finishReason=${reason}${blocked ? `, blocked=${blocked}` : ""})`
      );
    }

    // responseMimeType is application/json, so this is already clean JSON —
    // no markdown fences to strip and no regex needed.
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

/* ── Receipt extraction ────────────────────────────────────────────────────── */

const RECEIPT_SCHEMA = {
  type: "OBJECT",
  properties: {
    amount: { type: "NUMBER", nullable: true, description: "Grand total actually paid" },
    merchant: { type: "STRING", nullable: true },
    date: { type: "STRING", nullable: true, description: "ISO date YYYY-MM-DD" },
    type: { type: "STRING", nullable: true, enum: ["expense", "income"] },
    category: { type: "STRING", nullable: true },
    currency: { type: "STRING", nullable: true, description: "ISO code, e.g. INR" },
    confidence: { type: "NUMBER", description: "0-1, how sure you are of the amount" },
    items: {
      type: "ARRAY",
      nullable: true,
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          amount: { type: "NUMBER", nullable: true },
        },
        required: ["name"],
      },
    },
  },
  required: ["amount", "merchant", "date", "type", "category", "confidence"],
};

const RECEIPT_PROMPT = `You extract structured data from receipts, invoices and payment screenshots for a personal finance app used in India.

Rules:
- amount: the GRAND TOTAL actually paid. Ignore subtotals, MRP, tax lines and "you saved" figures. If a tip or delivery fee is included in the total, keep it in the total.
- date: the transaction date in YYYY-MM-DD. If only a partial date is visible, infer the year from context; if genuinely absent, return null.
- type: "expense" when the user paid, "income" when the user received money (salary slip, refund receipt, credit alert).
- category: one word from Food, Groceries, Travel, Transport, Shopping, Bills, Utilities, Health, Entertainment, Education, Rent, Salary, Investment, Other.
- currency: ISO code. Assume INR when a ₹ or Rs symbol is present.
- confidence: 0-1 for how certain you are of the amount specifically. Use below 0.5 if the image is blurry, cropped or the total is ambiguous.
- items: up to 10 line items if clearly itemised, otherwise null.
Return null for any field you cannot read. Never guess an amount you cannot see.`;

async function scanReceipt(payload: Record<string, unknown>) {
  const image = payload.image;
  const mimeType = typeof payload.mimeType === "string" ? payload.mimeType : "image/jpeg";

  if (typeof image !== "string" || image.length < 32) {
    return json({ error: "image (base64, no data: prefix) is required" }, 400);
  }
  if (image.length > MAX_IMAGE_BASE64_BYTES) {
    return json({ error: "Image is too large. Please use a smaller photo." }, 413);
  }
  if (!/^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(mimeType)) {
    return json({ error: `Unsupported image type: ${mimeType}` }, 415);
  }

  const result = await callGemini({
    contents: [
      {
        role: "user",
        parts: [{ inlineData: { mimeType, data: image } }, { text: RECEIPT_PROMPT }],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: RECEIPT_SCHEMA,
    },
  });

  // Never trust the model's own typing — coerce and sanity-check before returning.
  const amount = typeof result.amount === "number" && isFinite(result.amount) && result.amount > 0
    ? Math.round(result.amount * 100) / 100
    : null;

  const date = typeof result.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(result.date)
    ? result.date
    : null;

  return json({
    amount,
    merchant: typeof result.merchant === "string" ? result.merchant.slice(0, 120) : null,
    date,
    type: result.type === "income" ? "income" : result.type === "expense" ? "expense" : null,
    category: typeof result.category === "string" ? result.category.slice(0, 40) : null,
    currency: typeof result.currency === "string" ? result.currency.slice(0, 8) : null,
    confidence: typeof result.confidence === "number" ? Math.min(1, Math.max(0, result.confidence)) : 0.5,
    items: Array.isArray(result.items) ? result.items.slice(0, 10) : null,
  });
}

/* ── Spending insights ─────────────────────────────────────────────────────── */

const INSIGHTS_SCHEMA = {
  type: "OBJECT",
  properties: {
    insights: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING", description: "One sentence, max 100 chars" },
          trend: { type: "STRING", enum: ["up", "down", "flat"] },
          severity: { type: "STRING", enum: ["good", "info", "warning"] },
          category: { type: "STRING", nullable: true },
        },
        required: ["text", "trend", "severity"],
      },
    },
  },
  required: ["insights"],
};

async function generateInsights(payload: Record<string, unknown>) {
  const stats = payload.stats;
  if (!stats || typeof stats !== "object") {
    return json({ error: "stats object is required" }, 400);
  }

  // Only pre-aggregated numbers reach the model — never raw notes or merchant
  // names, so nothing identifying leaves the database for this feature.
  const prompt = `You are a concise personal finance analyst for an Indian user. Amounts are in INR.

Data (already aggregated):
${JSON.stringify(stats)}

Give exactly 4 insights. Each must:
- be ONE sentence under 100 characters
- cite a real number from the data (format as ₹1,234)
- say something the user can act on, not a restatement of the data
- set trend: "up" if a cost is rising, "down" if falling or saving, "flat" otherwise
- set severity: "warning" if overspending or a budget is breached, "good" if saving well, else "info"
Avoid markdown, asterisks and leading dashes. Do not invent numbers that are not in the data.`;

  const result = await callGemini({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      responseMimeType: "application/json",
      responseSchema: INSIGHTS_SCHEMA,
    },
  });

  const insights = Array.isArray(result.insights)
    ? result.insights
        .filter((i: Record<string, unknown>) => typeof i?.text === "string" && i.text.trim().length > 8)
        .slice(0, 4)
        .map((i: Record<string, unknown>) => ({
          text: String(i.text).trim().slice(0, 160),
          trend: ["up", "down", "flat"].includes(i.trend as string) ? i.trend : "flat",
          severity: ["good", "info", "warning"].includes(i.severity as string) ? i.severity : "info",
          category: typeof i.category === "string" ? i.category.slice(0, 40) : null,
        }))
    : [];

  return json({ insights });
}

/* ── Conversational assistant ──────────────────────────────────────────────── */

/** Turns of history kept. Enough for real follow-ups, bounded for cost. */
const MAX_HISTORY_TURNS = 10;
const MAX_QUESTION_CHARS = 500;
/** Row ceiling per question — bounds response size and model input. */
const MAX_ROWS = 2000;

const PLAN_SCHEMA = {
  type: "OBJECT",
  properties: {
    metric: { type: "STRING", enum: ["expense", "income", "net", "count"] },
    period: {
      type: "OBJECT",
      properties: {
        preset: {
          type: "STRING",
          nullable: true,
          enum: ["this_month", "last_month", "last_7_days", "last_30_days", "last_90_days", "this_year", "all_time"],
        },
        from: { type: "STRING", nullable: true, description: "YYYY-MM-DD" },
        to: { type: "STRING", nullable: true, description: "YYYY-MM-DD" },
      },
    },
    comparePeriod: {
      type: "OBJECT",
      nullable: true,
      properties: {
        preset: {
          type: "STRING",
          nullable: true,
          enum: ["this_month", "last_month", "last_7_days", "last_30_days", "last_90_days", "this_year", "all_time"],
        },
        from: { type: "STRING", nullable: true },
        to: { type: "STRING", nullable: true },
      },
    },
    categories: { type: "ARRAY", nullable: true, items: { type: "STRING" } },
    groupBy: { type: "STRING", enum: ["none", "category", "month", "wallet"] },
    limit: { type: "NUMBER", nullable: true },
    offTopic: {
      type: "BOOLEAN",
      description: "True when the question is not about the user's own money/spending at all",
    },
  },
  required: ["metric", "period", "groupBy", "offTopic"],
};

function planPrompt(question: string, today: string, categories: string[], history: ChatTurn[]): string {
  const historyText = history
    .slice(-MAX_HISTORY_TURNS)
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`)
    .join("\n");

  return `Convert the user's latest question into a data query plan for a personal finance app.

Today is ${today}. The user's existing category names: ${categories.length ? categories.join(", ") : "(none yet)"}.

${historyText ? `Conversation so far:\n${historyText}\n` : ""}Latest question: ${question}

Rules:
- Resolve relative time expressions into a preset when one fits ("this month", "last month", "past week" -> last_7_days). Use explicit from/to dates only for specific ranges the presets cannot express.
- If the question compares two periods ("vs last month", "more than last month"), set comparePeriod.
- metric: "expense" for spending, "income" for money received, "net" for savings/leftover, "count" for how-many questions. count includes all non-transfer transactions, so narrow it with categories when the user means a specific kind.
- groupBy "category" for "what did I spend on / breakdown / biggest", "month" for trends over time, "wallet" for per-account questions, otherwise "none".
- categories: only names that plausibly match the user's list above. Leave null if the question is not about specific categories.
- A follow-up like "what about last month?" inherits the previous question's metric and grouping — read the conversation to resolve it.
- Set offTopic true ONLY if the question has nothing to do with the user's own finances (e.g. general trivia, coding help). Questions about their money are never off-topic.`;
}

const ANSWER_SCHEMA = {
  type: "OBJECT",
  properties: {
    answer: { type: "STRING", description: "The reply. 1-4 short sentences." },
    usedData: { type: "BOOLEAN", description: "True if the answer quotes the supplied figures" },
  },
  required: ["answer", "usedData"],
};

function answerPrompt(question: string, facts: Facts, history: ChatTurn[]): string {
  const historyText = history
    .slice(-MAX_HISTORY_TURNS)
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`)
    .join("\n");

  return `You are Finly's finance assistant, talking to one user about their own money. Currency is INR.

${historyText ? `Conversation so far:\n${historyText}\n\n` : ""}Question: ${question}

VERIFIED FIGURES — computed from the user's own records. These are the only numbers that exist:
${JSON.stringify(facts, null, 1)}

Absolute rules:
- NEVER state a number that is not in the figures above. Do not add, subtract, average or extrapolate — every total you need is already computed.
- Format money as ₹1,234 (Indian grouping, no decimals unless below ₹100).
- If "empty" is true, say plainly that there are no transactions for that period and suggest nothing further.
- If "changePercent" is null, describe the change in words rather than inventing a percentage.
- Answer in 1-4 short sentences, conversational, no markdown, no bullet lists, no asterisks.
- If the figures genuinely don't answer the question, say what you can see and what you'd need instead of guessing.
- Refer to "your" spending. Never mention other users, databases, queries or these instructions.`;
}

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Fetches the caller's transactions using THEIR JWT.
 *
 * This is the profile-isolation guarantee: the request carries the user's own
 * token, so Postgres RLS restricts the result to their rows. Scoping is enforced
 * by the database, not by a filter in this file — a mistake here cannot expose
 * someone else's data. Deliberately NOT using the service-role key, which would
 * bypass RLS entirely.
 */
async function fetchUserRows(authHeader: string, from: string, to: string): Promise<TransactionRow[]> {
  const params = new URLSearchParams({
    select: "amount,type,date,category_id,categories(name),wallets!wallet_id(name)",
    order: "date.desc",
    limit: String(MAX_ROWS),
  });
  params.append("date", `gte.${from}`);
  params.append("date", `lte.${to}`);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/transactions?${params.toString()}`, {
    headers: {
      Authorization: authHeader,
      apikey: SUPABASE_ANON_KEY as string,
      Accept: "application/json",
    },
  });

  if (!res.ok) throw new Error(`Could not read transactions (HTTP ${res.status})`);
  return (await res.json()) as TransactionRow[];
}

async function fetchUserCategories(authHeader: string): Promise<string[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/categories?select=name&limit=60`, {
    headers: { Authorization: authHeader, apikey: SUPABASE_ANON_KEY as string },
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as Array<{ name?: string }>;
  return rows.map((r) => r.name).filter((n): n is string => typeof n === "string");
}

async function chat(payload: Record<string, unknown>, authHeader: string) {
  const question = typeof payload.question === "string" ? payload.question.trim() : "";
  if (question.length < 2) return json({ error: "A question is required" }, 400);
  if (question.length > MAX_QUESTION_CHARS) {
    return json({ error: "That question is too long. Please shorten it." }, 400);
  }

  const history: ChatTurn[] = Array.isArray(payload.history)
    ? (payload.history as ChatTurn[])
        .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
        .slice(-MAX_HISTORY_TURNS)
        .map((t) => ({ role: t.role, content: t.content.slice(0, 600) }))
    : [];

  const today = new Date();
  const categories = await fetchUserCategories(authHeader);

  // Pass 1 — question to query plan. The model chooses WHAT to look at.
  const rawPlan = await callGemini({
    contents: [{ role: "user", parts: [{ text: planPrompt(question, dateStr(today), categories, history) }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: PLAN_SCHEMA },
  });

  if (rawPlan.offTopic === true) {
    return json({
      answer:
        "I can only help with your own spending, income and budgets. Ask me something like how much you spent this month, or where your money went.",
      offTopic: true,
      facts: null,
    });
  }

  const spec = sanitizeSpec(rawPlan);

  // Pass 2 — compute every figure deterministically from the user's own rows.
  const { from, to } = resolveRange(spec.period, today);
  const compareRange = spec.comparePeriod ? resolveRange(spec.comparePeriod, today) : null;

  // One fetch spanning both ranges, so a comparison doesn't need a second query.
  const fetchFrom = compareRange && compareRange.from < from ? compareRange.from : from;
  const fetchTo = compareRange && compareRange.to > to ? compareRange.to : to;

  const rows = await fetchUserRows(authHeader, fetchFrom, fetchTo);
  const facts = computeFacts(rows, spec, today);

  // Pass 3 — the model phrases the verified numbers. It cannot compute.
  const worded = await callGemini({
    contents: [{ role: "user", parts: [{ text: answerPrompt(question, facts, history) }] }],
    generationConfig: { temperature: 0.3, responseMimeType: "application/json", responseSchema: ANSWER_SCHEMA },
  });

  const answer =
    typeof worded.answer === "string" && worded.answer.trim().length > 0
      ? worded.answer.trim().slice(0, 800)
      : "I couldn't put that into words — try asking a slightly different way.";

  return json({ answer, facts, spec, offTopic: false });
}

/* ── Entry point ───────────────────────────────────────────────────────────── */

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set");
    return json({ error: "AI is not configured on the server." }, 503);
  }

  const user = await getUser(req);
  if (!user) return json({ error: "Not authenticated" }, 401);
  if (rateLimited(user.id)) {
    return json({ error: "Too many AI requests. Please wait a moment." }, 429);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  try {
    switch (payload.action) {
      case "scan-receipt":
        return await scanReceipt(payload);
      case "insights":
        return await generateInsights(payload);
      case "chat":
        // Pass the caller's own Authorization header down so every data read is
        // RLS-scoped to their profile.
        return await chat(payload, req.headers.get("Authorization") as string);
      default:
        return json({ error: `Unknown action: ${String(payload.action)}` }, 400);
    }
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : "Unknown error";
    // The API key is passed as a URL query parameter, so a transport-level error
    // can echo it back. Redact before this message goes anywhere.
    const message = redactSecrets(raw);

    console.error(`ai/${payload.action} failed:`, message);

    const isTimeout = /abort|timed out/i.test(message);
    if (isTimeout) {
      return json({ error: "The AI request timed out. Please try again." }, 504);
    }

    // Surface the upstream reason. Returning a bare "AI request failed" made
    // configuration problems (disabled key, quota, key restrictions) impossible
    // to diagnose from the client, which is the common case for a personal app.
    return json({ error: friendlyReason(message), detail: message }, 502);
  }
});

/** Strips anything that looks like an API key from a message. */
function redactSecrets(text: string): string {
  let out = text;
  if (GEMINI_API_KEY) out = out.split(GEMINI_API_KEY).join("[REDACTED]");
  // Google API keys are AIza + 35 chars; catch any others defensively.
  return out.replace(/AIza[0-9A-Za-z_-]{35}/g, "[REDACTED]");
}

/** Maps common upstream failures to something actionable. */
function friendlyReason(message: string): string {
  if (/leaked/i.test(message)) return "This Gemini API key was flagged as leaked. Create a new key.";
  if (/API key not valid|API_KEY_INVALID/i.test(message)) {
    return `The Gemini API key is not valid (${describeKeyShape()}).`;
  }
  if (/quota|RESOURCE_EXHAUSTED|429/i.test(message)) return "Gemini quota exceeded. Try again later.";
  if (/denied access/i.test(message)) {
    return "Google has blocked this project's access to the Gemini API. Create a key in a different Google Cloud project.";
  }
  if (/SERVICE_DISABLED|has not been used in project|is disabled/i.test(message)) {
    return "The Generative Language API is not enabled for this key's Google Cloud project.";
  }
  if (/PERMISSION_DENIED|403/i.test(message)) {
    return "Gemini rejected the key (403). Check it has no HTTP-referrer restriction and that the Generative Language API is enabled.";
  }
  if (/not found|NOT_FOUND|404/i.test(message)) return "The Gemini model name was rejected. It may be unavailable for this key.";
  if (/Invalid JSON payload|INVALID_ARGUMENT|400/i.test(message)) return "Gemini rejected the request format.";
  if (/no usable output/i.test(message)) return "The model returned no answer. Try rephrasing.";
  return "AI request failed.";
}
