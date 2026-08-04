import { describe, it, expect } from "vitest";
import {
  filterByMonth,
  sumByTypeInMonth,
  validateTransaction,
  computeNewBalance,
  round2,
  savingsRate,
  formatIndianLive,
} from "@/lib/finance";

const tx = (date: string, type: "income" | "expense", amount: number) => ({ date, type, amount });

describe("filterByMonth", () => {
  it("includes the first and last day of the month", () => {
    // Regression: these were parsed as UTC midnight then read with local
    // getMonth(), so the 1st fell into the previous month for UTC-negative zones.
    const items = [tx("2024-03-01", "expense", 100), tx("2024-03-31", "expense", 50)];
    expect(filterByMonth(items, 2024, 2)).toHaveLength(2);
  });

  it("excludes adjacent months", () => {
    const items = [
      tx("2024-02-29", "expense", 10),
      tx("2024-03-15", "expense", 20),
      tx("2024-04-01", "expense", 30),
    ];
    const march = filterByMonth(items, 2024, 2);
    expect(march).toHaveLength(1);
    expect(march[0].date).toBe("2024-03-15");
  });

  it("handles dates carrying a time component", () => {
    expect(filterByMonth([tx("2024-03-01T23:30:00Z", "expense", 5)], 2024, 2)).toHaveLength(1);
  });

  it("does not shift across a year boundary", () => {
    const items = [tx("2024-01-01", "expense", 1), tx("2023-12-31", "expense", 2)];
    expect(filterByMonth(items, 2024, 0)).toHaveLength(1);
    expect(filterByMonth(items, 2023, 11)).toHaveLength(1);
  });
});

describe("sumByTypeInMonth", () => {
  it("sums only the requested type within the month", () => {
    const items = [
      tx("2024-03-01", "expense", 100.5),
      tx("2024-03-02", "income", 900),
      tx("2024-03-03", "expense", 49.5),
      tx("2024-04-01", "expense", 999),
    ];
    expect(sumByTypeInMonth(items, "expense", 2024, 2)).toBe(150);
    expect(sumByTypeInMonth(items, "income", 2024, 2)).toBe(900);
  });

  it("returns 0 for an empty month", () => {
    expect(sumByTypeInMonth([], "expense", 2024, 2)).toBe(0);
  });
});

describe("validateTransaction", () => {
  const base = { type: "expense" as const, wallet_id: "w1", walletBalance: 1000 };

  it("rejects non-numeric and zero amounts", () => {
    expect(validateTransaction({ ...base, amount: "abc" }).valid).toBe(false);
    expect(validateTransaction({ ...base, amount: 0 }).valid).toBe(false);
    expect(validateTransaction({ ...base, amount: -5 }).valid).toBe(false);
  });

  it("requires a wallet", () => {
    expect(validateTransaction({ amount: 10, type: "expense" }).valid).toBe(false);
  });

  it("rejects a transfer to the same wallet", () => {
    const result = validateTransaction({
      amount: 10,
      type: "transfer",
      wallet_id: "w1",
      to_wallet_id: "w1",
      walletBalance: 500,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/different/i);
  });

  it("rejects an expense larger than the balance", () => {
    expect(validateTransaction({ ...base, amount: 1000.01 }).valid).toBe(false);
  });

  it("accepts an expense exactly equal to the balance", () => {
    expect(validateTransaction({ ...base, amount: 1000 }).valid).toBe(true);
  });

  it("does not balance-check income", () => {
    expect(validateTransaction({ ...base, type: "income", amount: 999999 }).valid).toBe(true);
  });
});

describe("computeNewBalance", () => {
  it("adds income and subtracts expense", () => {
    expect(computeNewBalance(100, 25, "income")).toBe(125);
    expect(computeNewBalance(100, 25, "expense")).toBe(75);
  });

  it("moves money in the right direction for transfers", () => {
    expect(computeNewBalance(100, 30, "transfer", "from")).toBe(70);
    expect(computeNewBalance(100, 30, "transfer", "to")).toBe(130);
  });

  it("avoids floating point drift", () => {
    expect(computeNewBalance(0.3, 0.1, "expense")).toBe(0.2);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});

describe("savingsRate", () => {
  it("clamps to 0-100 and handles zero income", () => {
    expect(savingsRate(0, 500)).toBe(0);
    expect(savingsRate(1000, 1500)).toBe(0);
    expect(savingsRate(1000, 250)).toBe(75);
    expect(savingsRate(1000, 0)).toBe(100);
  });
});

describe("formatIndianLive", () => {
  it("groups digits in the Indian system", () => {
    expect(formatIndianLive("100")).toBe("100");
    expect(formatIndianLive("1000")).toBe("1,000");
    expect(formatIndianLive("100000")).toBe("1,00,000");
    expect(formatIndianLive("10000000")).toBe("1,00,00,000");
  });

  it("preserves a decimal tail", () => {
    expect(formatIndianLive("1234.56")).toBe("1,234.56");
  });
});
