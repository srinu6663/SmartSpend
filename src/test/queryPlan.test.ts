import { describe, it, expect } from "vitest";
import {
  resolveRange,
  sanitizeSpec,
  computeFacts,
  dateStr,
  type TransactionRow,
  type QuerySpec,
} from "../../supabase/functions/ai/queryPlan";

/** Fixed "today": Tue 4 Aug 2026. */
const TODAY = new Date(2026, 7, 4);

const row = (
  date: string,
  type: "expense" | "income" | "transfer",
  amount: number,
  category?: string,
  wallet?: string
): TransactionRow => ({
  date,
  type,
  amount,
  categories: category ? { name: category } : null,
  wallets: wallet ? { name: wallet } : null,
});

describe("resolveRange", () => {
  it("this_month starts on the 1st and ends today", () => {
    expect(resolveRange({ preset: "this_month" }, TODAY)).toEqual({ from: "2026-08-01", to: "2026-08-04" });
  });

  it("last_month covers the full previous month", () => {
    expect(resolveRange({ preset: "last_month" }, TODAY)).toEqual({ from: "2026-07-01", to: "2026-07-31" });
  });

  it("last_month rolls back across a year boundary", () => {
    const jan = new Date(2026, 0, 15);
    expect(resolveRange({ preset: "last_month" }, jan)).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("last_month handles February in a leap year", () => {
    const march = new Date(2024, 2, 10);
    expect(resolveRange({ preset: "last_month" }, march)).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });

  it("last_7_days is inclusive of today — 7 days, not 8", () => {
    const r = resolveRange({ preset: "last_7_days" }, TODAY);
    expect(r).toEqual({ from: "2026-07-29", to: "2026-08-04" });
  });

  it("last_30_days spans exactly 30 days inclusive", () => {
    const r = resolveRange({ preset: "last_30_days" }, TODAY);
    expect(r).toEqual({ from: "2026-07-06", to: "2026-08-04" });
  });

  it("this_year starts on 1 January", () => {
    expect(resolveRange({ preset: "this_year" }, TODAY)).toEqual({ from: "2026-01-01", to: "2026-08-04" });
  });

  it("honours explicit dates", () => {
    const r = resolveRange({ from: "2026-03-01", to: "2026-03-31" }, TODAY);
    expect(r).toEqual({ from: "2026-03-01", to: "2026-03-31" });
  });

  it("swaps reversed explicit dates instead of returning an empty range", () => {
    const r = resolveRange({ from: "2026-03-31", to: "2026-03-01" }, TODAY);
    expect(r).toEqual({ from: "2026-03-01", to: "2026-03-31" });
  });

  it("never returns a range extending into the future", () => {
    const r = resolveRange({ from: "2026-08-01", to: "2030-01-01" }, TODAY);
    expect(r.to).toBe("2026-08-04");
  });

  it("falls back to this month for garbage input", () => {
    expect(resolveRange({ from: "not-a-date", to: "??" }, TODAY)).toEqual({
      from: "2026-08-01",
      to: "2026-08-04",
    });
    expect(resolveRange(null, TODAY)).toEqual({ from: "2026-08-01", to: "2026-08-04" });
  });

  it("treats a lone 'from' as 'since then until today'", () => {
    expect(resolveRange({ from: "2026-06-15" }, TODAY)).toEqual({ from: "2026-06-15", to: "2026-08-04" });
  });
});

describe("sanitizeSpec", () => {
  it("defaults unknown metrics and groupings to safe values", () => {
    const s = sanitizeSpec({ metric: "hallucinated", groupBy: "nonsense" });
    expect(s.metric).toBe("expense");
    expect(s.groupBy).toBe("none");
  });

  it("drops non-string categories and caps the list", () => {
    const s = sanitizeSpec({ categories: ["Food", 42, null, "Travel"] });
    expect(s.categories).toEqual(["Food", "Travel"]);
  });

  it("normalises an empty category list to null", () => {
    expect(sanitizeSpec({ categories: [] }).categories).toBeNull();
  });

  it("clamps a silly limit", () => {
    expect(sanitizeSpec({ limit: 9999 }).limit).toBe(12);
    expect(sanitizeSpec({ limit: -3 }).limit).toBeNull();
  });

  it("survives null and undefined", () => {
    expect(sanitizeSpec(null).metric).toBe("expense");
    expect(sanitizeSpec(undefined).period).toEqual({});
  });
});

describe("computeFacts", () => {
  const rows: TransactionRow[] = [
    row("2026-08-01", "expense", 500, "Food", "HDFC"),
    row("2026-08-02", "expense", 300, "Travel", "HDFC"),
    row("2026-08-03", "expense", 200, "Food", "Cash"),
    row("2026-08-02", "income", 5000, "Salary", "HDFC"),
    row("2026-08-02", "transfer", 1000, null, "HDFC"),
    row("2026-07-15", "expense", 900, "Food", "HDFC"), // previous month
  ];

  const spec = (over: Partial<QuerySpec> = {}): QuerySpec =>
    sanitizeSpec({ metric: "expense", period: { preset: "this_month" }, ...over });

  it("sums only the requested metric, within the range", () => {
    const f = computeFacts(rows, spec(), TODAY);
    expect(f.value).toBe(1000); // 500 + 300 + 200, July excluded
    expect(f.range).toEqual({ from: "2026-08-01", to: "2026-08-04" });
  });

  it("excludes transfers from totals", () => {
    // The ₹1000 transfer must not inflate expense — moving your own money is
    // not spending.
    const f = computeFacts(rows, spec(), TODAY);
    expect(f.totalExpense).toBe(1000);
    expect(f.transactionCount).toBe(4); // 3 expenses + 1 income, no transfer
  });

  it("computes income and net correctly", () => {
    const f = computeFacts(rows, spec({ metric: "net" }), TODAY);
    expect(f.totalIncome).toBe(5000);
    expect(f.net).toBe(4000); // 5000 - 1000
    expect(f.value).toBe(4000);
  });

  it("filters by category with loose matching", () => {
    const f = computeFacts(rows, spec({ categories: ["food"] }), TODAY);
    expect(f.value).toBe(700); // 500 + 200
  });

  it("groups by category, largest first, with shares", () => {
    const f = computeFacts(rows, spec({ groupBy: "category" }), TODAY);
    expect(f.groups.map((g) => g.label)).toEqual(["Food", "Travel"]);
    expect(f.groups[0].amount).toBe(700);
    expect(f.groups[0].share).toBe(70);
    expect(f.groups[0].count).toBe(2);
  });

  it("groups by wallet", () => {
    const f = computeFacts(rows, spec({ groupBy: "wallet" }), TODAY);
    expect(f.groups.find((g) => g.label === "HDFC")?.amount).toBe(800);
    expect(f.groups.find((g) => g.label === "Cash")?.amount).toBe(200);
  });

  it("groups months chronologically, not by size", () => {
    const f = computeFacts(rows, spec({ period: { preset: "last_90_days" }, groupBy: "month" }), TODAY);
    expect(f.groups.map((g) => g.label)).toEqual(["2026-07", "2026-08"]);
  });

  it("compares against another period", () => {
    const f = computeFacts(
      rows,
      spec({ period: { preset: "this_month" }, comparePeriod: { preset: "last_month" } }),
      TODAY
    );
    expect(f.value).toBe(1000);
    expect(f.comparison?.value).toBe(900);
    expect(f.comparison?.change).toBe(100);
    expect(f.comparison?.changePercent).toBeCloseTo(11.1, 1);
  });

  it("returns null percent change against a zero baseline, not Infinity", () => {
    const f = computeFacts(
      rows,
      spec({ period: { preset: "this_month" }, comparePeriod: { from: "2020-01-01", to: "2020-01-31" } }),
      TODAY
    );
    expect(f.comparison?.value).toBe(0);
    expect(f.comparison?.changePercent).toBeNull();
    expect(Number.isFinite(f.comparison!.change)).toBe(true);
  });

  it("flags an empty result so the model must say it has no data", () => {
    const f = computeFacts([], spec(), TODAY);
    expect(f.empty).toBe(true);
    expect(f.value).toBe(0);
    expect(f.groups).toEqual([]);
  });

  it("ignores rows with an unparseable date rather than throwing", () => {
    const dirty = [...rows, row("not-a-date", "expense", 99999, "Food")];
    const f = computeFacts(dirty, spec(), TODAY);
    expect(f.value).toBe(1000);
  });

  it("counts every non-transfer transaction when the metric is count", () => {
    // "How many transactions this month?" means all money movements — 3 expenses
    // plus 1 income. The transfer is still excluded.
    const f = computeFacts(rows, spec({ metric: "count" }), TODAY);
    expect(f.value).toBe(4);
  });

  it("narrows a count by category", () => {
    // "How many times did I spend on food?" — the category filter is what
    // restricts a count, since count itself is direction-agnostic.
    const f = computeFacts(rows, spec({ metric: "count", categories: ["Food"] }), TODAY);
    expect(f.value).toBe(2);
  });
});

describe("dateStr", () => {
  it("uses local parts so the day never shifts", () => {
    expect(dateStr(new Date(2026, 7, 1, 0, 15))).toBe("2026-08-01");
    expect(dateStr(new Date(2026, 11, 31, 23, 45))).toBe("2026-12-31");
  });
});
