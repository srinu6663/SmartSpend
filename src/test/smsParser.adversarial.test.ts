import { describe, it, expect } from "vitest";
import { parseBankSMS, isRejected } from "@/lib/smsParser";

/**
 * Cases the parser was NOT written against, added to check it generalises rather
 * than fitting the happy-path samples in smsParser.test.ts.
 */
const NOW = new Date(2026, 7, 4, 14, 0, 0);

describe("adversarial / generalisation", () => {
  it("handles the balance appearing BEFORE the transaction amount", () => {
    const r = parseBankSMS(
      "Avl Bal Rs.5432.10. Rs.450.00 debited from a/c XX1234 to VPA swiggy@ybl Ref 456789123",
      NOW
    );
    if (isRejected(r)) throw new Error(r.reason);
    expect(r.amount).toBe(450);
  });

  it("handles lakh-grouped Indian amounts", () => {
    const r = parseBankSMS("Rs.1,50,000.00 credited to A/c XX1234 on 01-08-26 Ref 111222333", NOW);
    if (isRejected(r)) throw new Error(r.reason);
    expect(r.amount).toBe(150000);
  });

  it("handles suffixed currency notation", () => {
    const r = parseBankSMS("A/c XX1234 debited by 780.50 INR on 03-08-26 Ref 445566778", NOW);
    if (isRejected(r)) throw new Error(r.reason);
    expect(r.amount).toBe(780.5);
  });

  it("handles the rupee symbol", () => {
    const r = parseBankSMS("₹1,299 spent on Card xx4455 at MYNTRA on 02-08-26", NOW);
    if (isRejected(r)) throw new Error(r.reason);
    expect(r.amount).toBe(1299);
  });

  it("is case-insensitive on keywords", () => {
    const r = parseBankSMS("RS.500.00 DEBITED FROM A/C XX1234 ON 04-08-26 REF 123456789", NOW);
    if (isRejected(r)) throw new Error(r.reason);
    expect(r.amount).toBe(500);
    expect(r.direction).toBe("expense");
  });

  it("picks the user's own account movement when both verbs appear", () => {
    // "debited" (user) then "credited" (beneficiary) — must read as an expense.
    const r = parseBankSMS(
      "A/c XX1234 debited Rs.900 on 04-08-26; beneficiary RAM credited. Ref 778899001",
      NOW
    );
    if (isRejected(r)) throw new Error(r.reason);
    expect(r.direction).toBe("expense");
    expect(r.amount).toBe(900);
  });

  it("does not treat 'minimum due' as the transaction amount", () => {
    const r = parseBankSMS(
      "Statement for Card xx1234: Total due Rs.7,500. Min due Rs.375. Rs.2,499 spent at FLIPKART on 01-08-26",
      NOW
    );
    if (isRejected(r)) throw new Error(r.reason);
    expect(r.amount).toBe(2499);
  });

  it("survives a message with no spaces around the amount", () => {
    const r = parseBankSMS("Rs.320debited from a/c XX1234 on 04-08-26 Ref 123123123", NOW);
    if (isRejected(r)) throw new Error(r.reason);
    expect(r.amount).toBe(320);
  });

  it("does not crash on odd input", () => {
    expect(() => parseBankSMS("₹₹₹", NOW)).not.toThrow();
    expect(() => parseBankSMS("Rs. debited credited", NOW)).not.toThrow();
    expect(() => parseBankSMS("0000000000000000", NOW)).not.toThrow();
  });

  it("rejects a zero amount rather than booking it", () => {
    const r = parseBankSMS("Rs.0.00 debited from a/c XX1234 on 04-08-26 Ref 123456789", NOW);
    expect(isRejected(r)).toBe(true);
  });
});
