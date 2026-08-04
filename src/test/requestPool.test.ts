import { describe, it, expect } from "vitest";
import { ConcurrencyLimiter, SingleFlight, abortPromise } from "@/lib/requestPool";

const tick = () => new Promise((r) => setTimeout(r, 0));
const defer = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("ConcurrencyLimiter", () => {
  it("never exceeds max concurrent holders", async () => {
    const limiter = new ConcurrencyLimiter(3);
    let active = 0;
    let peak = 0;

    const task = async () => {
      const release = await limiter.acquire();
      active++;
      peak = Math.max(peak, active);
      await tick();
      active--;
      release();
    };

    await Promise.all(Array.from({ length: 25 }, task));

    expect(peak).toBe(3);
    expect(limiter.stats).toEqual({ active: 0, queued: 0, max: 3 });
  });

  it("does not over-admit when a caller arrives during a slot handoff", async () => {
    // Regression guard: if release() decremented `active` before waking a
    // waiter, a caller arriving in the microtask gap would take the same slot.
    const limiter = new ConcurrencyLimiter(1);

    const first = await limiter.acquire();
    const queued = limiter.acquire();

    first(); // hand the slot to `queued`
    const late = limiter.acquire(); // arrives in the gap — must NOT be admitted

    let lateAdmitted = false;
    void late.then(() => {
      lateAdmitted = true;
    });

    await tick();
    expect(lateAdmitted).toBe(false);
    expect(limiter.stats.active).toBe(1);

    (await queued)();
    await tick();
    expect(lateAdmitted).toBe(true);

    (await late)();
    expect(limiter.stats).toEqual({ active: 0, queued: 0, max: 1 });
  });

  it("treats a double release as a single release", async () => {
    const limiter = new ConcurrencyLimiter(2);
    const release = await limiter.acquire();

    release();
    release();
    release();

    expect(limiter.stats.active).toBe(0);
  });

  it("frees the slot when the work throws", async () => {
    const limiter = new ConcurrencyLimiter(1);

    for (let i = 0; i < 3; i++) {
      const release = await limiter.acquire();
      try {
        throw new Error("boom");
      } catch {
        /* expected */
      } finally {
        release();
      }
    }

    expect(limiter.stats.active).toBe(0);
  });
});

describe("SingleFlight", () => {
  it("collapses concurrent calls with the same key into one execution", async () => {
    const flight = new SingleFlight<string>();
    let calls = 0;
    const gate = defer<void>();

    const work = async () => {
      calls++;
      await gate.promise;
      return "value";
    };

    const results = Promise.all([
      flight.run("a", work),
      flight.run("a", work),
      flight.run("a", work),
    ]);

    expect(flight.size).toBe(1);
    gate.resolve();

    expect(await results).toEqual(["value", "value", "value"]);
    expect(calls).toBe(1);
  });

  it("keeps different keys independent", async () => {
    const flight = new SingleFlight<string>();
    let calls = 0;
    const work = async (v: string) => {
      calls++;
      return v;
    };

    const [a, b] = await Promise.all([flight.run("a", () => work("a")), flight.run("b", () => work("b"))]);

    expect([a, b]).toEqual(["a", "b"]);
    expect(calls).toBe(2);
  });

  it("clears the entry after settling so later calls re-execute", async () => {
    const flight = new SingleFlight<number>();
    let calls = 0;
    const work = async () => ++calls;

    expect(await flight.run("k", work)).toBe(1);
    expect(flight.size).toBe(0);
    expect(await flight.run("k", work)).toBe(2);
  });

  it("clears the entry after a rejection and propagates to all waiters", async () => {
    const flight = new SingleFlight<number>();
    const gate = defer<number>();
    const work = () => gate.promise;

    const a = flight.run("k", work);
    const b = flight.run("k", work);
    gate.reject(new Error("nope"));

    await expect(a).rejects.toThrow("nope");
    await expect(b).rejects.toThrow("nope");
    expect(flight.size).toBe(0);
  });
});

describe("abortPromise", () => {
  it("rejects immediately for an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(abortPromise(controller.signal)).rejects.toBeDefined();
  });

  it("rejects when the signal aborts later", async () => {
    const controller = new AbortController();
    const pending = abortPromise(controller.signal);
    controller.abort(new Error("cancelled"));
    await expect(pending).rejects.toThrow("cancelled");
  });

  it("lets one caller cancel without disturbing the shared work", async () => {
    // The dedupe contract: an aborting caller must not cancel the shared read.
    const flight = new SingleFlight<string>();
    const gate = defer<string>();
    const controller = new AbortController();

    const shared = flight.run("k", () => gate.promise);
    const cancellable = Promise.race([shared, abortPromise(controller.signal)]);

    controller.abort(new Error("unmounted"));
    await expect(cancellable).rejects.toThrow("unmounted");

    gate.resolve("still delivered");
    expect(await shared).toBe("still delivered");
  });
});
