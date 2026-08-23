export type LoginLimitResult = { allowed: true } | { allowed: false };

type AttemptState = {
  failures: number[];
  blockedUntil: number | null;
  lastSeen: number;
};

type LoginAttemptLimiterOptions = {
  maxAttempts?: number;
  windowMs?: number;
  blockMs?: number;
  maxEntries?: number;
};

export class LoginAttemptLimiter {
  private readonly attempts = new Map<string, AttemptState>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly blockMs: number;
  private readonly maxEntries: number;

  constructor(options: LoginAttemptLimiterOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 5;
    this.windowMs = options.windowMs ?? 15 * 60_000;
    this.blockMs = options.blockMs ?? 15 * 60_000;
    this.maxEntries = options.maxEntries ?? 1_000;
  }

  check(key: string, now: number): LoginLimitResult {
    const state = this.getCurrentState(key, now);

    if (state?.blockedUntil && state.blockedUntil > now) {
      return { allowed: false };
    }

    return { allowed: true };
  }

  recordFailure(key: string, now: number) {
    this.cleanExpired(now);
    const current = this.getCurrentState(key, now);

    if (!current && this.attempts.size >= this.maxEntries) {
      const oldestKey = [...this.attempts.entries()].sort(
        ([, left], [, right]) => left.lastSeen - right.lastSeen,
      )[0]?.[0];

      if (oldestKey) {
        this.attempts.delete(oldestKey);
      }
    }

    const failures = [...(current?.failures ?? []), now];
    this.attempts.set(key, {
      failures,
      blockedUntil:
        failures.length >= this.maxAttempts ? now + this.blockMs : null,
      lastSeen: now,
    });
  }

  recordSuccess(key: string) {
    this.attempts.delete(key);
  }

  private getCurrentState(key: string, now: number) {
    const state = this.attempts.get(key);

    if (!state) {
      return null;
    }

    if (state.blockedUntil !== null) {
      if (state.blockedUntil > now) {
        return state;
      }

      this.attempts.delete(key);
      return null;
    }

    const failures = state.failures.filter(
      (failedAt) => failedAt > now - this.windowMs,
    );

    if (failures.length === 0) {
      this.attempts.delete(key);
      return null;
    }

    state.failures = failures;
    state.lastSeen = now;
    return state;
  }

  private cleanExpired(now: number) {
    for (const key of this.attempts.keys()) {
      this.getCurrentState(key, now);
    }
  }
}
