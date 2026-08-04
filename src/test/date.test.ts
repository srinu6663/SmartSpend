import { describe, it, expect } from "vitest";
import { toDateString, monthKey, parseDateString, isToday, isYesterday } from "@/lib/date";

describe("toDateString", () => {
  it("uses local calendar parts, not UTC", () => {
    // 1 Aug 2026 00:30 local. toISOString() in any timezone ahead of UTC would
    // report 31 July — the bug this helper exists to prevent.
    const d = new Date(2026, 7, 1, 0, 30);
    expect(toDateString(d)).toBe("2026-08-01");
  });

  it("zero-pads month and day", () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("handles the last instant of a day", () => {
    expect(toDateString(new Date(2026, 11, 31, 23, 59, 59))).toBe("2026-12-31");
  });
});

describe("monthKey", () => {
  it("returns the first of the month regardless of the day", () => {
    expect(monthKey(new Date(2026, 7, 4))).toBe("2026-08-01");
    expect(monthKey(new Date(2026, 7, 31, 23, 59))).toBe("2026-08-01");
  });

  it("does not roll back a month at local midnight on the 1st", () => {
    // The Budgets page regression: this returned "2026-07-31" via toISOString().
    expect(monthKey(new Date(2026, 7, 1, 0, 0, 0))).toBe("2026-08-01");
  });
});

describe("parseDateString", () => {
  it("parses as local midnight, not UTC midnight", () => {
    const d = parseDateString("2026-08-04");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(4);
    expect(d.getHours()).toBe(0);
  });

  it("tolerates a trailing time component", () => {
    expect(toDateString(parseDateString("2026-08-04T18:30:00Z"))).toBe("2026-08-04");
  });

  it("round-trips with toDateString", () => {
    const value = "2026-03-01";
    expect(toDateString(parseDateString(value))).toBe(value);
  });
});

describe("isToday / isYesterday", () => {
  it("identifies today and yesterday in local time", () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    expect(isToday(toDateString(today))).toBe(true);
    expect(isYesterday(toDateString(today))).toBe(false);
    expect(isYesterday(toDateString(yesterday))).toBe(true);
    expect(isToday(toDateString(yesterday))).toBe(false);
  });

  it("is false for an unrelated date", () => {
    expect(isToday("1999-01-01")).toBe(false);
    expect(isYesterday("1999-01-01")).toBe(false);
  });
});
