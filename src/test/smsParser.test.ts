import { describe, it, expect } from "vitest";
import {
  parseBankSMS,
  isRejected,
  needsAIFallback,
  fingerprintSMS,
  AUTO_IMPORT_THRESHOLD,
  type ParsedSMS,
} from "@/lib/smsParser";

/** Fixed "now" so 2-digit years and date sanity checks are deterministic. */
const NOW = new Date(2026, 7, 4, 14, 0, 0); // 4 Aug 2026, local

const parsed = (body: string, at: Date = NOW): ParsedSMS => {
  const r = parseBankSMS(body, at);
  if (isRejected(r)) throw new Error(`Expected a transaction, got rejection: ${r.reason}`);
  return r;
};

const rejection = (body: string, at: Date = NOW): string => {
  const r = parseBankSMS(body, at);
  if (!isRejected(r)) throw new Error(`Expected rejection, got amount ${r.amount}`);
  return r.reason;
};

describe("real bank debit alerts", () => {
  it("HDFC UPI debit — picks the transaction amount, not the balance", () => {
    // The balance (5,432.10) is LARGER than the amount (450). Grabbing the first
    // or biggest number would book the balance as a purchase.
    const r = parsed(
      "Rs.450.00 debited from a/c XX1234 on 04-08-26 to VPA swiggy@ybl. Avl Bal Rs.5432.10. Ref 456789123. -HDFC Bank"
    );
    expect(r.amount).toBe(450);
    expect(r.direction).toBe("expense");
    expect(r.accountTail).toBe("1234");
    expect(r.date).toBe("2026-08-04");
    expect(r.reference).toBe("456789123");
    expect(r.merchant).toBe("swiggy");
  });

  it("ICICI debit with a named month", () => {
    const r = parsed(
      "ICICI Bank Acct XX567 debited for Rs 1,250.75 on 02-Aug-26; AMAZON credited. UPI:987654321012."
    );
    expect(r.amount).toBe(1250.75);
    expect(r.direction).toBe("expense");
    expect(r.date).toBe("2026-08-02");
    expect(r.accountTail).toBe("567");
  });

  it("SBI debit with slash-separated date", () => {
    const r = parsed(
      "Dear Customer, Rs.1200.00 debited from A/c XXXXX4321 on 03/08/26 to VPA amazonpay@apl Ref No 112233445566. -SBI"
    );
    expect(r.amount).toBe(1200);
    expect(r.direction).toBe("expense");
    expect(r.date).toBe("2026-08-03");
  });

  it("Axis debit with Info block", () => {
    const r = parsed(
      "INR 250.00 debited from A/c no. XX8899 on 04-08-2026 IST. Info: UPI/P2M/419988776/BIGBASKET. Avl Bal INR 12,000.00"
    );
    expect(r.amount).toBe(250);
    expect(r.direction).toBe("expense");
    expect(r.accountTail).toBe("8899");
  });

  it("credit card spend", () => {
    const r = parsed(
      "Rs 2,499.00 spent on your HDFC Bank Credit Card xx7788 at FLIPKART on 01-08-26. Avl limit Rs 47,501.00"
    );
    expect(r.amount).toBe(2499);
    expect(r.direction).toBe("expense");
    expect(r.instrument).toBe("card");
    expect(r.merchant).toBe("FLIPKART");
  });

  it("ATM withdrawal", () => {
    const r = parsed("Rs.3000 withdrawn from A/c XX1234 on 30-07-26. Avl Bal Rs.9000. -Bank");
    expect(r.amount).toBe(3000);
    expect(r.direction).toBe("expense");
  });
});

describe("real bank credit alerts", () => {
  it("salary credit via NEFT", () => {
    const r = parsed(
      "Rs.50000.00 credited to A/c XX1234 on 01-08-26 by NEFT from ACME PAYROLL. Avl Bal Rs.55432.10"
    );
    expect(r.amount).toBe(50000);
    expect(r.direction).toBe("income");
    expect(r.date).toBe("2026-08-01");
  });

  it("UPI money received", () => {
    const r = parsed("You have received Rs.500.00 from rahul@oksbi on 04-08-26. UPI Ref 556677889900");
    expect(r.amount).toBe(500);
    expect(r.direction).toBe("income");
  });
});

describe("messages that must NOT become transactions", () => {
  it("rejects OTPs even when they contain digits", () => {
    expect(rejection("Your OTP for txn of Rs.5000 is 483920. Do not share this OTP with anyone.")).toMatch(
      /OTP/i
    );
  });

  it("rejects promotional offers", () => {
    expect(rejection("Congratulations! You are pre-approved for a personal loan of Rs.5,00,000. Apply now!")).toMatch(
      /Promotional/i
    );
    expect(rejection("Flat 50% cashback up to Rs.200 on your next order. Offer ends soon!")).toMatch(
      /Promotional/i
    );
  });

  it("rejects future/scheduled debits", () => {
    // Booking this would double-count once the real debit alert arrives.
    expect(rejection("Rs.2000 will be debited from A/c XX1234 on 10-08-26 towards your SIP.")).toMatch(
      /Scheduled/i
    );
  });

  it("rejects payment due reminders", () => {
    expect(rejection("Your credit card payment of Rs.7,500 is due on 15-08-26. Pay now to avoid charges.")).toMatch(
      /reminder|Promotional/i
    );
  });

  it("rejects balance-only replies", () => {
    expect(rejection("Avl Bal in A/c XX1234 as on 04-08-26 is Rs.5,432.10. -HDFC Bank")).toMatch(
      /balance|debit\/credit/i
    );
  });

  it("rejects failed and reversed transactions", () => {
    expect(rejection("Your payment of Rs.1200 to SWIGGY has failed. Amount will be refunded.")).toMatch(
      /Failed|Scheduled/i
    );
  });

  it("rejects collect requests", () => {
    expect(
      rejection("rahul@oksbi has requested Rs.500 from you. Approve in your UPI app.")
    ).toMatch(/Collect request|request/i);
  });

  it("rejects unrelated chatter", () => {
    expect(rejection("Hey, are we still meeting at 5pm today?")).toBeTruthy();
  });

  it("rejects an empty or tiny body", () => {
    expect(rejection("")).toMatch(/short/i);
    expect(rejection("Rs.5")).toMatch(/short/i);
  });
});

describe("date handling", () => {
  it("falls back to the SMS timestamp when no date is stated", () => {
    const r = parsed("Rs.99.00 debited from a/c XX1234 to VPA test@ybl Ref 123456789");
    expect(r.date).toBe("2026-08-04");
  });

  it("expands 2-digit years without landing in the future", () => {
    const r = parsed("Rs.100 debited from A/c XX1234 on 31-12-25 Ref 999888777");
    expect(r.date).toBe("2025-12-31");
  });

  it("ignores a stated date that would be in the future", () => {
    // A misparse must not produce a transaction dated next year.
    const r = parsed("Rs.100 debited from A/c XX1234 on 01-01-30 Ref 999888777");
    expect(r.date).toBe("2026-08-04");
  });

  it("reads day-first, not month-first", () => {
    const r = parsed("Rs.100 debited from A/c XX1234 on 13-07-26 Ref 999888777");
    expect(r.date).toBe("2026-07-13");
  });
});

describe("confidence and AI fallback", () => {
  it("scores a fully-structured bank alert high enough to auto-import", () => {
    const r = parsed(
      "Rs.450.00 debited from a/c XX1234 on 04-08-26 to VPA swiggy@ybl. Avl Bal Rs.5432.10. Ref 456789123."
    );
    expect(r.confidence).toBeGreaterThanOrEqual(AUTO_IMPORT_THRESHOLD);
    expect(needsAIFallback(r)).toBe(false);
  });

  it("scores a bare message too low to auto-import", () => {
    const r = parsed("Rs.500 debited");
    expect(r.confidence).toBeLessThan(AUTO_IMPORT_THRESHOLD);
    expect(needsAIFallback(r)).toBe(true);
  });

  it("never escalates OTPs or promos to the AI fallback", () => {
    const otp = parseBankSMS("Your OTP is 123456. Do not share.", NOW);
    const promo = parseBankSMS("Congratulations! Pre-approved offer of Rs.100000. Apply now", NOW);
    expect(needsAIFallback(otp)).toBe(false);
    expect(needsAIFallback(promo)).toBe(false);
  });
});

describe("fingerprintSMS", () => {
  const body = "Rs.450.00 debited from a/c XX1234 on 04-08-26 to VPA swiggy@ybl. Ref 456789123.";

  it("is stable for the same message", () => {
    expect(fingerprintSMS(parsed(body), body)).toBe(fingerprintSMS(parsed(body), body));
  });

  it("prefers the bank reference as the key", () => {
    expect(fingerprintSMS(parsed(body), body)).toBe("ref:456789123");
  });

  it("still distinguishes different messages without a reference", () => {
    const a = "Rs.450.00 debited from a/c XX1234 on 04-08-26 to VPA swiggy@ybl";
    const b = "Rs.650.00 debited from a/c XX1234 on 04-08-26 to VPA zomato@ybl";
    expect(fingerprintSMS(parsed(a), a)).not.toBe(fingerprintSMS(parsed(b), b));
  });

  it("treats whitespace-only differences as the same message", () => {
    const spaced = "Rs.450.00  debited  from a/c XX1234 on 04-08-26 to VPA  swiggy@ybl";
    const tight = "Rs.450.00 debited from a/c XX1234 on 04-08-26 to VPA swiggy@ybl";
    expect(fingerprintSMS(parsed(spaced), spaced)).toBe(fingerprintSMS(parsed(tight), tight));
  });
});
