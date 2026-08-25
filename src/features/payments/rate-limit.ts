type RateLimitTransaction = {
  $queryRaw: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => PromiseLike<unknown>;
};

type ConsumeBucketInput = {
  key: string;
  now: Date;
  windowMs: number;
  limit: number;
};

export class PaymentRateLimitedError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Payment rate limit exceeded");
    this.name = "PaymentRateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function paymentLimitKeys(clientKey: string) {
  return {
    clientRequests: `client:requests:10m:${clientKey}`,
    clientAttempts: `client:attempts:10m:${clientKey}`,
    globalRequests: "global:requests:1m",
    globalAttempts: "global:attempts:1m",
  } as const;
}

export async function consumeBucket(
  tx: RateLimitTransaction,
  { key, now, windowMs, limit }: ConsumeBucketInput,
): Promise<void> {
  const windowStart = new Date(
    Math.floor(now.getTime() / windowMs) * windowMs,
  );
  const expiresAt = new Date(windowStart.getTime() + windowMs);
  const rows = (await tx.$queryRaw`
    INSERT INTO "PaymentRateLimitBucket" (
      "key",
      "windowStart",
      "count",
      "expiresAt"
    )
    VALUES (
      ${key},
      ${windowStart}::timestamptz AT TIME ZONE 'UTC',
      1,
      ${expiresAt}::timestamptz AT TIME ZONE 'UTC'
    )
    ON CONFLICT ("key", "windowStart")
    DO UPDATE SET
      "count" = "PaymentRateLimitBucket"."count" + 1,
      "expiresAt" = EXCLUDED."expiresAt"
    RETURNING "count"
  `) as Array<{ count: number }>;

  if (rows[0].count > limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((expiresAt.getTime() - now.getTime()) / 1_000),
    );
    throw new PaymentRateLimitedError(retryAfterSeconds);
  }
}
