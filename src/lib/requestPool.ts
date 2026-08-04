/**
 * Client-side request pooling primitives.
 *
 * The browser has no Postgres connections to pool — supabase-js speaks HTTPS to
 * PostgREST/GoTrue. What it *does* have is an unbounded ability to fire
 * overlapping requests: every tab focus, every remount, every retry. Left alone
 * that produces exactly the "zombie multiples" problem — dozens of identical
 * in-flight requests racing each other, each one able to clobber state with a
 * stale response.
 *
 * These two primitives bound that:
 *   ConcurrencyLimiter — at most N requests in flight; the rest queue (a pool).
 *   SingleFlight       — identical concurrent reads share one response.
 */

type Release = () => void;

export class ConcurrencyLimiter {
  /** Occupied slots. Invariant: 0 <= active <= max, always. */
  private active = 0;
  private waiters: Array<() => void> = [];

  constructor(private readonly max: number) {
    if (max < 1) throw new Error("ConcurrencyLimiter: max must be >= 1");
  }

  async acquire(): Promise<Release> {
    if (this.active < this.max) {
      this.active++;
    } else {
      // Wait for a slot to be *handed over*. `active` deliberately stays
      // unchanged across the handoff: if release() decremented first, a caller
      // arriving in the microtask gap before this waiter resumed would see a
      // free slot and take it too, putting active at max + 1.
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }

    let released = false;
    return () => {
      if (released) return; // double-release must not inflate the pool
      released = true;

      const next = this.waiters.shift();
      if (next) next(); // hand the slot over; active unchanged
      else this.active--; // nobody waiting; give the slot back
    };
  }

  get stats(): { active: number; queued: number; max: number } {
    return { active: this.active, queued: this.waiters.length, max: this.max };
  }
}

/**
 * Collapses concurrent calls sharing a key into a single execution.
 *
 * Note the deliberate asymmetry with cancellation: the shared work is *not*
 * bound to any single caller's AbortSignal, because one component unmounting
 * must not cancel a request three others are still waiting on. Callers that
 * need per-caller cancellation race their own signal on top of the shared
 * promise (see resilientFetch).
 */
export class SingleFlight<T> {
  private readonly inflight = new Map<string, Promise<T>>();

  run(key: string, work: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) return existing;

    const promise = work().finally(() => {
      this.inflight.delete(key);
    });

    this.inflight.set(key, promise);
    return promise;
  }

  get size(): number {
    return this.inflight.size;
  }
}

/** Rejects when `signal` aborts; never resolves otherwise. */
export function abortPromise(signal: AbortSignal): Promise<never> {
  return new Promise<never>((_, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    signal.addEventListener(
      "abort",
      () => reject(signal.reason ?? new DOMException("Aborted", "AbortError")),
      { once: true }
    );
  });
}
