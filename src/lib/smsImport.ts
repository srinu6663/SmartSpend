import { supabase } from "@/lib/supabase";
import { SmsReader, isSmsAvailable, type RawSMS } from "@/lib/smsReader";
import {
  parseBankSMS,
  isRejected,
  fingerprintSMS,
  AUTO_IMPORT_THRESHOLD,
  type ParsedSMS,
} from "@/lib/smsParser";
import { useDataStore } from "@/store/useDataStore";

/**
 * SMS → transaction import pipeline.
 *
 *   read inbox → parse on-device → claim fingerprint → auto-add or queue
 *
 * Ordering matters: the fingerprint is claimed in the database BEFORE a
 * transaction is created. If the claim is skipped the message was already seen,
 * so nothing happens — that is what makes a repeated scan, a replayed broadcast
 * or a fresh install idempotent rather than a duplicate flood.
 */

/** Where the last-scanned timestamp lives, so a scan only reads new messages. */
const HIGH_WATER_KEY = "finly-sms-highwater";
const ENABLED_KEY = "finly-sms-enabled";

export interface ImportOutcome {
  scanned: number;
  imported: number;
  queued: number;
  skippedDuplicate: number;
  rejected: number;
}

const emptyOutcome = (): ImportOutcome => ({
  scanned: 0,
  imported: 0,
  queued: 0,
  skippedDuplicate: 0,
  rejected: 0,
});

/* ── Local settings ────────────────────────────────────────────────────────── */

export const isImportEnabled = (): boolean => {
  try {
    return localStorage.getItem(ENABLED_KEY) === "true";
  } catch {
    return false;
  }
};

export const setImportEnabled = (enabled: boolean): void => {
  try {
    localStorage.setItem(ENABLED_KEY, String(enabled));
  } catch {
    /* storage unavailable */
  }
};

const readHighWater = (): number => {
  try {
    const raw = Number(localStorage.getItem(HIGH_WATER_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  } catch {
    return 0;
  }
};

const writeHighWater = (value: number): void => {
  try {
    localStorage.setItem(HIGH_WATER_KEY, String(value));
  } catch {
    /* storage unavailable */
  }
};

/* ── Wallet / category resolution ──────────────────────────────────────────── */

/** Rough merchant→category keywords. Deliberately conservative. */
const CATEGORY_HINTS: Array<{ match: RegExp; category: RegExp }> = [
  { match: /swiggy|zomato|dominos|restaurant|cafe|eatery|food/i, category: /food|dining/i },
  { match: /bigbasket|blinkit|zepto|dmart|grocer|supermarket/i, category: /grocer|food/i },
  { match: /uber|ola|rapido|irctc|metro|petrol|fuel|indian oil|hp ?petrol/i, category: /transport|travel|fuel/i },
  { match: /amazon|flipkart|myntra|ajio|meesho|nykaa/i, category: /shop/i },
  { match: /jio|airtel|vi |vodafone|bses|electric|gas|water|broadband|wifi/i, category: /bill|utilit/i },
  { match: /netflix|spotify|prime|hotstar|youtube/i, category: /entertain|subscription/i },
  { match: /pharmacy|apollo|medplus|hospital|clinic|diagnostic/i, category: /health|medical/i },
  { match: /salary|payroll|stipend/i, category: /salary|income/i },
];

/**
 * Picks the wallet a message belongs to.
 *
 * Best effort by design: matches the masked account tail against the wallet name
 * (so naming a wallet "HDFC 1234" makes this exact), otherwise falls back to the
 * first wallet. A wrong-but-visible guess the user can correct beats refusing to
 * import — but this is also why anything uncertain is queued rather than added.
 */
function resolveWallet(parsed: ParsedSMS): string | null {
  const wallets = useDataStore.getState().wallets;
  if (wallets.length === 0) return null;

  if (parsed.accountTail) {
    const byTail = wallets.find((w) => w.name.includes(parsed.accountTail!));
    if (byTail) return byTail.id;
  }

  if (parsed.instrument === "card") {
    const card = wallets.find((w) => w.type === "credit");
    if (card) return card.id;
  }

  return wallets[0].id;
}

function resolveCategory(parsed: ParsedSMS): string | null {
  const wanted = parsed.direction === "income" ? "income" : "expense";
  const categories = useDataStore.getState().categories.filter((c) => c.type === wanted);
  if (categories.length === 0) return null;

  const haystack = `${parsed.merchant ?? ""}`;
  for (const hint of CATEGORY_HINTS) {
    if (!hint.match.test(haystack)) continue;
    const match = categories.find((c) => hint.category.test(c.name));
    if (match) return match.id;
  }

  const other = categories.find((c) => /other|misc/i.test(c.name));
  return (other ?? categories[0]).id;
}

/* ── Core ──────────────────────────────────────────────────────────────────── */

/**
 * Records the message and creates a transaction when confident.
 * Returns which branch was taken, for the caller's tally.
 */
async function ingest(
  raw: RawSMS,
  parsed: ParsedSMS
): Promise<"imported" | "queued" | "duplicate"> {
  const fingerprint = fingerprintSMS(parsed, raw.body);
  const autoImport = parsed.confidence >= AUTO_IMPORT_THRESHOLD;

  // Atomic claim. NULL means this fingerprint already exists for this user.
  const { data: importId, error } = await supabase.rpc("claim_message_import", {
    p_source: "sms",
    p_fingerprint: fingerprint,
    p_sender: raw.sender,
    p_body: raw.body.slice(0, 1000),
    p_amount: parsed.amount,
    p_direction: parsed.direction,
    p_merchant: parsed.merchant,
    p_account_tail: parsed.accountTail,
    p_occurred_on: parsed.date,
    p_confidence: parsed.confidence,
    p_status: autoImport ? "imported" : "pending",
  });

  if (error) throw error;
  if (!importId) return "duplicate";

  if (!autoImport) return "queued";

  const walletId = resolveWallet(parsed);
  const categoryId = resolveCategory(parsed);

  const { error: txError } = await useDataStore.getState().addTransaction({
    amount: parsed.amount,
    type: parsed.direction,
    category_id: categoryId,
    wallet_id: walletId,
    to_wallet_id: null,
    note: parsed.merchant ? `${parsed.merchant} (auto-imported)` : "Auto-imported from SMS",
    date: parsed.date,
  });

  if (txError) {
    // The claim succeeded but the transaction didn't. Downgrade to pending so it
    // shows up for review instead of being silently lost — the fingerprint is
    // already claimed, so a later scan would otherwise skip it forever.
    await supabase
      .from("message_imports")
      .update({ status: "pending" })
      .eq("id", importId);
    return "queued";
  }

  await supabase
    .from("message_imports")
    .update({ reviewed_at: new Date().toISOString() })
    .eq("id", importId);

  return "imported";
}

/** Guards against two scans running at once (app focus + a fresh SMS). */
let scanInFlight: Promise<ImportOutcome> | null = null;

/**
 * Scans messages received since the last successful scan.
 * Concurrent callers share one run rather than double-importing.
 */
export function scanInbox(limit = 200): Promise<ImportOutcome> {
  if (scanInFlight) return scanInFlight;

  scanInFlight = (async () => {
    const outcome = emptyOutcome();
    if (!isSmsAvailable()) return outcome;

    const { granted } = await SmsReader.checkSmsPermission();
    if (!granted) return outcome;

    const since = readHighWater();
    const { messages } = await SmsReader.readInbox({ sinceMillis: since, limit });
    outcome.scanned = messages.length;

    let newest = since;

    for (const message of messages) {
      newest = Math.max(newest, message.receivedAt ?? 0);

      const parsed = parseBankSMS(message.body, new Date(message.receivedAt ?? Date.now()));
      if (isRejected(parsed)) {
        outcome.rejected++;
        continue;
      }

      try {
        const result = await ingest(message, parsed);
        if (result === "imported") outcome.imported++;
        else if (result === "queued") outcome.queued++;
        else outcome.skippedDuplicate++;
      } catch (err) {
        console.error("SMS import failed for one message:", err);
        // Keep going: one bad message must not abort the whole scan.
      }
    }

    // Advance the mark only after the loop, so a crash mid-scan re-reads rather
    // than skipping messages. Re-reading is safe — the fingerprint dedupes.
    if (newest > since) writeHighWater(newest);

    return outcome;
  })().finally(() => {
    scanInFlight = null;
  });

  return scanInFlight;
}

/** Handles a single live SMS from the native watcher. */
export async function handleIncomingSMS(raw: RawSMS): Promise<void> {
  const parsed = parseBankSMS(raw.body, new Date(raw.receivedAt ?? Date.now()));
  if (isRejected(parsed)) return;

  try {
    await ingest(raw, parsed);
    if (raw.receivedAt > readHighWater()) writeHighWater(raw.receivedAt);
  } catch (err) {
    console.error("Live SMS import failed:", err);
  }
}

/* ── Review queue ──────────────────────────────────────────────────────────── */

export interface PendingImport {
  id: string;
  amount: number;
  direction: "expense" | "income";
  merchant: string | null;
  account_tail: string | null;
  occurred_on: string;
  confidence: number;
  sender: string | null;
  body: string;
}

export async function fetchPendingImports(): Promise<PendingImport[]> {
  const { data, error } = await supabase
    .from("message_imports")
    .select("id, amount, direction, merchant, account_tail, occurred_on, confidence, sender, body")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as PendingImport[];
}

/** Creates the transaction for a queued import the user has approved. */
export async function approveImport(item: PendingImport): Promise<{ error: unknown }> {
  const parsedLike: ParsedSMS = {
    amount: item.amount,
    direction: item.direction,
    merchant: item.merchant,
    accountTail: item.account_tail,
    date: item.occurred_on,
    reference: null,
    instrument: null,
    confidence: item.confidence,
  };

  const { error } = await useDataStore.getState().addTransaction({
    amount: item.amount,
    type: item.direction,
    category_id: resolveCategory(parsedLike),
    wallet_id: resolveWallet(parsedLike),
    to_wallet_id: null,
    note: item.merchant ? `${item.merchant} (from SMS)` : "Imported from SMS",
    date: item.occurred_on,
  });

  if (error) return { error };

  await supabase
    .from("message_imports")
    .update({ status: "imported", reviewed_at: new Date().toISOString() })
    .eq("id", item.id);

  return { error: null };
}

/** Dismisses a queued import. It stays recorded, so it won't reappear. */
export async function ignoreImport(id: string): Promise<void> {
  await supabase
    .from("message_imports")
    .update({ status: "ignored", reviewed_at: new Date().toISOString() })
    .eq("id", id);
}
