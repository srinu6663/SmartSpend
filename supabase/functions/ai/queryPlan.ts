/**
 * Deterministic query planning and aggregation for the AI assistant.
 *
 * WHY THIS EXISTS
 * Language models are unreliable at arithmetic and will confidently invent
 * totals. For a finance app that is unacceptable — a wrong number is worse than
 * no answer. So the model never computes anything:
 *
 *   1. The model turns the question into a QuerySpec (structured output only).
 *   2. THIS module resolves the date range and computes every figure in plain
 *      TypeScript from the user's own rows.
 *   3. The model receives those computed facts and may only phrase them.
 *
 * Deliberately free of Deno APIs so it can be unit-tested with vitest — the date
 * range maths is exactly where off-by-one bugs hide, and it must be verifiable.
 */

export type Metric = "expense" | "income" | "net" | "count";
export type GroupBy = "none" | "category" | "month" | "wallet";

export type PeriodPreset =
  | "this_month"
  | "last_month"
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "this_year"
  | "all_time";

export interface Period {
  preset?: PeriodPreset;
  /** YYYY-MM-DD, used when preset is absent or "custom". */
  from?: string | null;
  to?: string | null;
}

export interface QuerySpec {
  metric: Metric;
  period: Period;
  /** Optional second period, for "vs last month" style questions. */
  comparePeriod?: Period | null;
  /** Category names to filter to, matched case-insensitively. */
  categories?: string[] | null;
  groupBy?: GroupBy;
  limit?: number | null;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface TransactionRow {
  amount: number | string;
  type: "expense" | "income" | "transfer";
  date: string;
  category_id?: string | null;
  categories?: { name?: string | null } | null;
  wallets?: { name?: string | null } | null;
}

export interface GroupTotal {
  label: string;
  amount: number;
  count: number;
  share: number;
}

export interface Facts {
  range: DateRange;
  metric: Metric;
  totalExpense: number;
  totalIncome: number;
  net: number;
  transactionCount: number;
  /** The figure the question actually asked for. */
  value: number;
  groups: GroupTotal[];
  comparison?: {
    range: DateRange;
    value: number;
    /** value - comparison.value */
    change: number;
    /** Percent change, null when the baseline is 0 (undefined, not infinite). */
    changePercent: number | null;
  } | null;
  /** True when nothing matched — the model must say so rather than guess. */
  empty: boolean;
}

/** Longest window we will scan, to bound cost and response size. */
const MAX_RANGE_DAYS = 1100; // ~3 years
const MAX_GROUPS = 12;

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD from local calendar parts (never toISOString — that shifts days). */
export const dateStr = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const isValidDateStr = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00`));

/**
 * Resolves a Period into concrete inclusive bounds.
 *
 * `today` is injected rather than read from the clock so this is testable and so
 * the whole request uses one consistent notion of "now".
 */
export function resolveRange(period: Period | null | undefined, today: Date): DateRange {
  const p = period ?? {};

  // Explicit dates win when both are valid — the model was specific.
  if (isValidDateStr(p.from) && isValidDateStr(p.to)) {
    const [from, to] = p.from <= p.to ? [p.from, p.to] : [p.to, p.from];
    return clampRange({ from, to }, today);
  }

  const y = today.getFullYear();
  const m = today.getMonth();

  switch (p.preset) {
    case "this_month":
      return { from: dateStr(new Date(y, m, 1)), to: dateStr(today) };

    case "last_month": {
      // Day 0 of this month === last day of the previous month, which also
      // handles January rolling back to December correctly.
      const first = new Date(y, m - 1, 1);
      const last = new Date(y, m, 0);
      return { from: dateStr(first), to: dateStr(last) };
    }

    case "last_7_days":
      return { from: dateStr(shiftDays(today, -6)), to: dateStr(today) };

    case "last_30_days":
      return { from: dateStr(shiftDays(today, -29)), to: dateStr(today) };

    case "last_90_days":
      return { from: dateStr(shiftDays(today, -89)), to: dateStr(today) };

    case "this_year":
      return { from: dateStr(new Date(y, 0, 1)), to: dateStr(today) };

    case "all_time":
      return { from: dateStr(shiftDays(today, -MAX_RANGE_DAYS)), to: dateStr(today) };

    default:
      // One valid bound and no preset: treat it as "from that date until today".
      if (isValidDateStr(p.from)) return clampRange({ from: p.from, to: dateStr(today) }, today);
      if (isValidDateStr(p.to)) return clampRange({ from: dateStr(shiftDays(today, -29)), to: p.to }, today);
      return { from: dateStr(new Date(y, m, 1)), to: dateStr(today) };
  }
}

function shiftDays(d: Date, days: number): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Keeps a range inside MAX_RANGE_DAYS and stops it running into the future. */
function clampRange(range: DateRange, today: Date): DateRange {
  const todayStr = dateStr(today);
  let { from, to } = range;

  if (to > todayStr) to = todayStr;

  const earliest = dateStr(shiftDays(today, -MAX_RANGE_DAYS));
  if (from < earliest) from = earliest;
  if (from > to) from = to;

  return { from, to };
}

/** Normalises whatever the model produced into a spec we can trust. */
export function sanitizeSpec(raw: unknown): QuerySpec {
  const input = (raw ?? {}) as Record<string, unknown>;

  const metric: Metric = ["expense", "income", "net", "count"].includes(input.metric as string)
    ? (input.metric as Metric)
    : "expense";

  const groupBy: GroupBy = ["none", "category", "month", "wallet"].includes(input.groupBy as string)
    ? (input.groupBy as GroupBy)
    : "none";

  const categories = Array.isArray(input.categories)
    ? input.categories.filter((c): c is string => typeof c === "string" && c.trim().length > 0).slice(0, 8)
    : null;

  const limitRaw = Number(input.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), MAX_GROUPS) : null;

  return {
    metric,
    period: (input.period ?? {}) as Period,
    comparePeriod: (input.comparePeriod ?? null) as Period | null,
    categories: categories && categories.length > 0 ? categories : null,
    groupBy,
    limit,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function inRange(date: string, range: DateRange): boolean {
  const day = date.slice(0, 10);
  return day >= range.from && day <= range.to;
}

function matchesCategories(row: TransactionRow, categories: string[] | null | undefined): boolean {
  if (!categories || categories.length === 0) return true;
  const name = (row.categories?.name ?? "").toLowerCase();
  if (!name) return false;
  // Substring both ways: "food" should match "Food & Dining", and a model
  // answering "Food & Dining" should match a category literally named "Food".
  return categories.some((c) => {
    const needle = c.toLowerCase().trim();
    return needle.length > 0 && (name.includes(needle) || needle.includes(name));
  });
}

function metricValue(rows: TransactionRow[], metric: Metric): number {
  const sum = (type: "expense" | "income") =>
    rows.filter((r) => r.type === type).reduce((s, r) => s + Number(r.amount || 0), 0);

  switch (metric) {
    case "expense":
      return round2(sum("expense"));
    case "income":
      return round2(sum("income"));
    case "net":
      return round2(sum("income") - sum("expense"));
    case "count":
      return rows.length;
  }
}

/**
 * Which rows count toward a metric.
 * Transfers are excluded from expense/income totals on purpose: moving money
 * between your own wallets is not spending, and counting it inflates every total.
 */
function relevantRows(rows: TransactionRow[], spec: QuerySpec, range: DateRange): TransactionRow[] {
  return rows.filter((r) => {
    if (!isValidDateStr(r.date?.slice(0, 10))) return false;
    if (!inRange(r.date, range)) return false;
    if (r.type === "transfer") return false;
    if (spec.metric === "expense" && r.type !== "expense") return false;
    if (spec.metric === "income" && r.type !== "income") return false;
    return matchesCategories(r, spec.categories);
  });
}

function groupRows(rows: TransactionRow[], groupBy: GroupBy, limit: number | null): GroupTotal[] {
  if (groupBy === "none") return [];

  const totals = new Map<string, { amount: number; count: number }>();

  for (const row of rows) {
    let label: string;
    if (groupBy === "category") label = row.categories?.name || "Uncategorised";
    else if (groupBy === "wallet") label = row.wallets?.name || "Unknown wallet";
    else label = row.date.slice(0, 7); // YYYY-MM

    const entry = totals.get(label) ?? { amount: 0, count: 0 };
    entry.amount += Number(row.amount || 0);
    entry.count += 1;
    totals.set(label, entry);
  }

  const grand = [...totals.values()].reduce((s, e) => s + e.amount, 0);

  const sorted = [...totals.entries()].map(([label, e]) => ({
    label,
    amount: round2(e.amount),
    count: e.count,
    share: grand > 0 ? Math.round((e.amount / grand) * 1000) / 10 : 0,
  }));

  // Months read naturally in chronological order; everything else by size.
  if (groupBy === "month") sorted.sort((a, b) => a.label.localeCompare(b.label));
  else sorted.sort((a, b) => b.amount - a.amount);

  return sorted.slice(0, limit ?? MAX_GROUPS);
}

/** Computes every figure the model is allowed to quote. */
export function computeFacts(rows: TransactionRow[], spec: QuerySpec, today: Date): Facts {
  const range = resolveRange(spec.period, today);
  const scoped = relevantRows(rows, spec, range);

  // Totals ignore the metric filter so the model always has context available.
  const contextRows = rows.filter(
    (r) => isValidDateStr(r.date?.slice(0, 10)) && inRange(r.date, range) && r.type !== "transfer" &&
      matchesCategories(r, spec.categories)
  );

  const facts: Facts = {
    range,
    metric: spec.metric,
    totalExpense: metricValue(contextRows, "expense"),
    totalIncome: metricValue(contextRows, "income"),
    net: metricValue(contextRows, "net"),
    transactionCount: contextRows.length,
    value: metricValue(scoped, spec.metric),
    groups: groupRows(scoped, spec.groupBy ?? "none", spec.limit ?? null),
    comparison: null,
    empty: contextRows.length === 0,
  };

  if (spec.comparePeriod) {
    const compareRange = resolveRange(spec.comparePeriod, today);
    const compareRows = relevantRows(rows, spec, compareRange);
    const compareValue = metricValue(compareRows, spec.metric);

    facts.comparison = {
      range: compareRange,
      value: compareValue,
      change: round2(facts.value - compareValue),
      // Percent change against a zero baseline is undefined, not Infinity —
      // returning null forces the model to describe it in words instead.
      changePercent:
        compareValue === 0 ? null : Math.round(((facts.value - compareValue) / Math.abs(compareValue)) * 1000) / 10,
    };
  }

  return facts;
}
