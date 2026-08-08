/**
 * Deterministic pseudo-random generation only — no `Math.random()` at request time, no
 * `Date.now()` in generated content (docs/14-frontend-implementation-plan.md §4.2:
 * "Fixtures are deterministic... risk H4 (flaky E2E) is designed out"). Every generator
 * module takes a seeded `Rng` and produces the same output on every process start.
 */

/** mulberry32 — small, fast, good-enough statistical quality for fixture data. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return new Rng(next);
}

export class Rng {
  constructor(private readonly next: () => number) {}

  /** Uniform float in [0, 1). */
  float(): number {
    return this.next();
  }

  /** Uniform integer in [min, max]. */
  int(min: number, max: number): number {
    return Math.floor(this.float() * (max - min + 1)) + min;
  }

  bool(probabilityTrue = 0.5): boolean {
    return this.float() < probabilityTrue;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Rng.pick: empty array");
    return items[this.int(0, items.length - 1)];
  }

  /** Weighted pick. `weights` need not sum to 1. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = this.float() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /** Float in [min, max), rounded to `decimals` places. */
  range(min: number, max: number, decimals = 2): number {
    const value = this.float() * (max - min) + min;
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }

  uuid(prefix: string): string {
    const hex = () => this.int(0, 0xffff).toString(16).padStart(4, "0");
    return `${prefix}_${hex()}${hex()}-${hex()}-${hex()}-${hex()}-${hex()}${hex()}${hex()}`;
  }
}

/** A fixed base instant, used for all relative timestamp generation. Never `Date.now()`. */
export const FIXTURE_EPOCH = Date.UTC(2026, 6, 1, 9, 0, 0); // 2026-07-01T09:00:00Z

export function isoAt(offsetMs: number): string {
  return new Date(FIXTURE_EPOCH + offsetMs).toISOString();
}

const DAY_MS = 24 * 60 * 60 * 1000;
export function isoDaysAgo(days: number): string {
  return isoAt(-days * DAY_MS);
}
