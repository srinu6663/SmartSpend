/**
 * Bank SMS parser for Indian bank / UPI alerts.
 *
 * Design constraints that shaped this:
 *
 *  - MOST SMS ARE NOT TRANSACTIONS. An inbox is mostly OTPs, promotions, EMI
 *    reminders and balance replies. A parser that is eager produces phantom
 *    transactions, which is worse than missing real ones — so anything that
 *    doesn't clearly describe a completed money movement is rejected outright.
 *
 *  - "AVAILABLE BALANCE" IS NOT THE AMOUNT. Nearly every debit alert also quotes
 *    the remaining balance, which is usually the LARGER number. Naively grabbing
 *    the first or biggest figure silently books your balance as a purchase, so
 *    balance-adjacent amounts are explicitly excluded.
 *
 *  - FUTURE TENSE IS NOT A TRANSACTION. "will be debited" / "is due on" describe
 *    something that hasn't happened. Booking those double-counts once the real
 *    debit alert arrives.
 *
 * Everything here is deterministic and offline. The AI path is only a fallback
 * for messages this cannot classify (see `needsAIFallback`).
 */

export type ParsedDirection = "expense" | "income";

export interface ParsedSMS {
  amount: number;
  direction: ParsedDirection;
  /** Merchant, VPA handle or counterparty, when identifiable. */
  merchant: string | null;
  /** Masked account/card tail, e.g. "1234". */
  accountTail: string | null;
  /** YYYY-MM-DD — from the message when stated, else the SMS timestamp. */
  date: string;
  /** Bank/UPI reference number, used for deduplication when present. */
  reference: string | null;
  /** Card, bank account, UPI or wallet. */
  instrument: "card" | "account" | "upi" | "wallet" | null;
  /** 0-1. Below 0.7 the UI asks for confirmation instead of auto-adding. */
  confidence: number;
}

export interface RejectedSMS {
  rejected: true;
  reason: string;
}

export type SMSParseResult = ParsedSMS | RejectedSMS;

export const isRejected = (r: SMSParseResult): r is RejectedSMS => "rejected" in r;

/* ── Rejection rules, applied before any extraction ────────────────────────── */

const REJECT_RULES: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(otp|one[\s-]?time[\s-]?password|verification code)\b/i, reason: "OTP message" },
  { pattern: /\bdo not share\b.*\b(otp|pin|code)\b/i, reason: "OTP message" },
  // Future/scheduled, not yet moved.
  { pattern: /\b(will be|shall be|to be)\s+(debited|deducted|charged|credited)\b/i, reason: "Scheduled, not completed" },
  { pattern: /\b(is|are)\s+due\b|\bdue\s+(on|by|date)\b/i, reason: "Payment reminder, not a transaction" },
  { pattern: /\b(e-?mandate|auto\s?pay)\s+(registered|set\s?up)\b/i, reason: "Mandate setup" },
  // Marketing.
  { pattern: /\b(offer|cashback up to|discount|sale|apply now|pre-?approved|eligible for|congratulations)\b/i, reason: "Promotional message" },
  { pattern: /\b(loan|credit card)\b.*\b(offer|apply|eligible|approved)\b/i, reason: "Promotional message" },
  // Failures and reversals need human judgement, not silent booking.
  { pattern: /\b(failed|declined|unsuccessful|could not be processed|reversed|refund initiated)\b/i, reason: "Failed or reversed transaction" },
  { pattern: /\brequest(ed)?\s+(money|payment)\b|\bhas requested\b/i, reason: "Collect request, not a payment" },
];

/** Words indicating money left the account. */
const DEBIT_WORDS =
  /\b(debited|debit|spent|paid|withdrawn|withdrawal|purchase|deducted|charged|sent|transferred to|payment of)\b/i;
/** Words indicating money arrived. */
const CREDIT_WORDS = /\b(credited|credit|received|deposited|added|refunded|cashback of)\b/i;

/** Balance-ish context — an amount here is NOT the transaction amount. */
const BALANCE_CONTEXT =
  /\b(a?v(ai)?l(able)?\.?\s*(bal|balance|limit)|bal(ance)?|outstanding|limit|remaining|clr\s?bal|total\s+due|min(imum)?\s+due)\b/i;

interface AmountMatch {
  value: number;
  index: number;
  length: number;
}

/** All currency amounts in the text, with positions. */
function findAmounts(text: string): AmountMatch[] {
  const out: AmountMatch[] = [];
  // Prefixed: Rs.1,234.50 / INR 1234 / ₹1,234
  const prefixed = /(?:rs\.?|inr|₹)\s*([\d][\d,]*(?:\.\d{1,2})?)/gi;
  // Suffixed: 1,234.50 Rs / 1234 INR
  const suffixed = /([\d][\d,]*(?:\.\d{1,2})?)\s*(?:rs\.?|inr|₹)/gi;

  for (const re of [prefixed, suffixed]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const value = Number(m[1].replace(/,/g, ""));
      if (!Number.isFinite(value) || value <= 0) continue;
      if (out.some((a) => a.index === m!.index)) continue;
      out.push({ value, index: m.index, length: m[0].length });
    }
  }

  return out.sort((a, b) => a.index - b.index);
}

/** True when the amount sits in balance/limit phrasing. */
function isBalanceAmount(text: string, match: AmountMatch): boolean {
  // Look behind far enough to catch "Avl Bal Rs.5,000" and "Available balance is
  // Rs 5,000" — but only within the CURRENT clause. Scanning blindly backwards
  // made a balance in a preceding sentence poison the real amount:
  //   "Avl Bal Rs.5432.10. Rs.450.00 debited ..."  → ₹450 read as a balance
  //   "Total due Rs.7,500. Min due Rs.375. Rs.2,499 spent ..." → same
  // Splitting on sentence breaks confines the check to the clause that actually
  // qualifies this amount.
  const window = text.slice(Math.max(0, match.index - 40), match.index);
  const clause = window.split(/[.;|]\s+/).pop() ?? window;
  if (BALANCE_CONTEXT.test(clause)) return true;

  // Also handle "Rs.5000 is your available balance".
  const after = text.slice(match.index + match.length, match.index + match.length + 28);
  return /^\s*(is|as)?\s*(your|the)?\s*(a?v(ai)?l(able)?)?\s*(bal|balance|limit)\b/i.test(after);
}

function detectDirection(text: string): ParsedDirection | null {
  const debitAt = text.search(DEBIT_WORDS);
  const creditAt = text.search(CREDIT_WORDS);

  if (debitAt === -1 && creditAt === -1) return null;
  if (creditAt === -1) return "expense";
  if (debitAt === -1) return "income";
  // Both present ("debited ... credited to beneficiary"): the first verb
  // describes what happened to the user's own account.
  return debitAt < creditAt ? "expense" : "income";
}

function extractAccountTail(text: string): string | null {
  const patterns = [
    /(?:a\/c|acct|account|card)\s*(?:no\.?|number)?\s*[:.]?\s*(?:x+|\*+)\s*(\d{3,6})/i,
    /(?:a\/c|acct|account|card)\s*(?:no\.?)?\s*[:.]?\s*(\d{3,6})\b/i,
    /\b(?:x{2,}|\*{2,})(\d{3,6})\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return null;
}

function extractMerchant(text: string): string | null {
  // A UPI VPA is the most reliable counterparty signal.
  const vpa = text.match(/\b([a-z0-9._-]{2,})@([a-z]{2,})\b/i);
  if (vpa) return vpa[1].replace(/[._-]+/g, " ").trim().slice(0, 60);

  const patterns = [
    /\b(?:at|to|towards|paid to|trf to|sent to)\s+([A-Z][A-Za-z0-9&.\-' ]{2,40}?)(?=\s+(?:on|for|ref|upi|avl|bal|dt|date|\.|,|$))/,
    /\bInfo\s*[:-]\s*([A-Za-z0-9*/. -]{3,40})/i,
    /\b(?:from)\s+([A-Z][A-Za-z0-9&.\-' ]{2,40}?)(?=\s+(?:on|ref|upi|avl|bal|\.|,|$))/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const cleaned = m[1].trim().replace(/\s{2,}/g, " ").replace(/[.,]$/, "");
      if (cleaned.length >= 2 && !/^(your|a\/c|acct|account)$/i.test(cleaned)) {
        return cleaned.slice(0, 60);
      }
    }
  }
  return null;
}

function extractReference(text: string): string | null {
  const patterns = [
    /\b(?:ref(?:erence)?|rrn|txn|transaction|upi)\s*(?:no\.?|id|:)?\s*[:-]?\s*([A-Z0-9]{6,20})\b/i,
    /\bUPI[/:]([0-9]{9,14})\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/** Expands a 2-digit year, assuming it isn't in the future. */
function expandYear(raw: string, now: Date): number {
  const n = Number(raw);
  if (raw.length === 4) return n;
  const century = Math.floor(now.getFullYear() / 100) * 100;
  const candidate = century + n;
  return candidate > now.getFullYear() + 1 ? candidate - 100 : candidate;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Date stated in the message, or null. Never returns a future date. */
function extractDate(text: string, now: Date): string | null {
  // 04-Aug-26 / 04 Aug 2026
  const named = text.match(/\b(\d{1,2})[\s\-/]([A-Za-z]{3,4})[\s\-/](\d{2,4})\b/);
  if (named) {
    const month = MONTHS[named[2].toLowerCase()];
    if (month) {
      const iso = `${expandYear(named[3], now)}-${pad(month)}-${pad(Number(named[1]))}`;
      if (isSaneDate(iso, now)) return iso;
    }
  }

  // 04-08-26 / 04/08/2026 — day-first, which is the Indian convention.
  const numeric = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const iso = `${expandYear(numeric[3], now)}-${pad(month)}-${pad(day)}`;
      if (isSaneDate(iso, now)) return iso;
    }
  }

  return null;
}

function isSaneDate(iso: string, now: Date): boolean {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  // Reject dates in the future or absurdly old — a misparse, not a real date.
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 86_400_000);
  return d <= tomorrow && d >= twoYearsAgo;
}

function detectInstrument(text: string): ParsedSMS["instrument"] {
  if (/\bcredit card|debit card|\bcard\b/i.test(text)) return "card";
  if (/\bupi\b|@[a-z]{2,}\b/i.test(text)) return "upi";
  if (/\bwallet|paytm|phonepe|gpay|google pay\b/i.test(text)) return "wallet";
  if (/\ba\/c|acct|account\b/i.test(text)) return "account";
  return null;
}

const toDateString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Parses a bank SMS.
 *
 * @param body      raw message text
 * @param receivedAt when the SMS arrived — used as the date when the message
 *                   doesn't state one, and to resolve 2-digit years.
 */
export function parseBankSMS(body: string, receivedAt: Date = new Date()): SMSParseResult {
  const text = (body ?? "")
    .replace(/\s+/g, " ")
    .trim()
    // Some senders omit the space after the amount ("Rs.320debited"). \b never
    // matches between a digit and a letter, so the keyword went undetected.
    // Scoped to our keywords only, to avoid mangling references like "AB12CD34".
    .replace(
      /(\d)(?=(?:debited|credited|debit|credit|spent|paid|withdrawn|received|deducted|charged)\b)/gi,
      "$1 "
    );

  if (text.length < 12) return { rejected: true, reason: "Too short to be a transaction alert" };

  for (const rule of REJECT_RULES) {
    if (rule.pattern.test(text)) return { rejected: true, reason: rule.reason };
  }

  const direction = detectDirection(text);
  if (!direction) return { rejected: true, reason: "No debit/credit wording found" };

  const amounts = findAmounts(text);
  if (amounts.length === 0) return { rejected: true, reason: "No amount found" };

  const candidates = amounts.filter((a) => !isBalanceAmount(text, a));
  if (candidates.length === 0) {
    return { rejected: true, reason: "Only a balance amount found, no transaction amount" };
  }

  // Prefer the amount nearest the direction verb — in practice the transaction
  // amount sits right next to "debited"/"credited".
  const verbIndex = text.search(direction === "expense" ? DEBIT_WORDS : CREDIT_WORDS);
  const chosen = candidates.reduce((best, a) =>
    Math.abs(a.index - verbIndex) < Math.abs(best.index - verbIndex) ? a : best
  );

  const stated = extractDate(text, receivedAt);
  const merchant = extractMerchant(text);
  const reference = extractReference(text);
  const accountTail = extractAccountTail(text);

  // Confidence reflects how much corroborating structure was found. A bare
  // "Rs.500 debited" is plausible but thin; account tail + reference + merchant
  // together look like a genuine bank alert.
  let confidence = 0.45;
  if (accountTail) confidence += 0.2;
  if (reference) confidence += 0.15;
  if (merchant) confidence += 0.1;
  if (stated) confidence += 0.1;
  if (amounts.length > candidates.length) confidence += 0.05; // balance also present: bank-alert shaped
  if (candidates.length > 1) confidence -= 0.1; // ambiguous which amount is the transaction

  return {
    amount: Math.round(chosen.value * 100) / 100,
    direction,
    merchant,
    accountTail,
    date: stated ?? toDateString(receivedAt),
    reference,
    instrument: detectInstrument(text),
    confidence: Math.max(0, Math.min(1, Math.round(confidence * 100) / 100)),
  };
}

/** Confidence at or above which an import may be added without confirmation. */
export const AUTO_IMPORT_THRESHOLD = 0.7;

/**
 * True when the deterministic parser found a money movement but isn't confident
 * enough to trust — the case worth spending an AI call on.
 */
export function needsAIFallback(result: SMSParseResult): boolean {
  if (isRejected(result)) {
    // Only escalate messages rejected for weak extraction, never OTPs or promos.
    return /No amount found|No debit\/credit wording/.test(result.reason);
  }
  return result.confidence < AUTO_IMPORT_THRESHOLD;
}

/**
 * Stable fingerprint for deduplication.
 *
 * Banks re-send alerts, Android can replay the same message to a receiver, and a
 * full inbox re-scan sees everything again. Keyed on reference when available
 * (the bank's own idempotency key), else on the amount/date/tail triple.
 */
export function fingerprintSMS(result: ParsedSMS, body: string): string {
  if (result.reference) return `ref:${result.reference}`;

  const normalized = body.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 180);
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `sig:${result.date}:${result.amount}:${result.accountTail ?? "x"}:${hash}`;
}
