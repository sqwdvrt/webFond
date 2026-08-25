const STALE_ATTEMPT_MS = 23 * 60 * 60 * 1_000;

export const PAYMENT_ATTEMPT_STORAGE_KEY = "byt-dobru.paymentAttempt.v1";

export type StoredPaymentAttempt = {
  version: 1;
  id: string;
  amountRoubles: number;
  createdAt: string;
  donationId?: string;
};

export type PaymentAttemptState =
  | { kind: "ready"; attempt: StoredPaymentAttempt }
  | { kind: "amount-change-needs-confirmation"; attempt: StoredPaymentAttempt }
  | { kind: "stale-needs-confirmation"; attempt: StoredPaymentAttempt };

export type PaymentAttemptStorageDependencies = {
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  randomUUID: () => string;
  now: () => Date;
};

function isStoredAttempt(value: unknown): value is StoredPaymentAttempt {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.version === 1 &&
    typeof record.id === "string" &&
    record.id.length > 0 &&
    typeof record.amountRoubles === "number" &&
    Number.isSafeInteger(record.amountRoubles) &&
    typeof record.createdAt === "string" &&
    !Number.isNaN(new Date(record.createdAt).getTime()) &&
    (record.donationId === undefined || typeof record.donationId === "string")
  );
}

function readStoredAttempt(
  storage: PaymentAttemptStorageDependencies["storage"],
): StoredPaymentAttempt | null {
  const raw = storage.getItem(PAYMENT_ATTEMPT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return isStoredAttempt(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredAttempt(
  storage: PaymentAttemptStorageDependencies["storage"],
  attempt: StoredPaymentAttempt,
) {
  storage.setItem(PAYMENT_ATTEMPT_STORAGE_KEY, JSON.stringify(attempt));
}

function createAttempt(
  amountRoubles: number,
  { now, randomUUID }: PaymentAttemptStorageDependencies,
): StoredPaymentAttempt {
  return {
    version: 1,
    id: randomUUID(),
    amountRoubles,
    createdAt: now().toISOString(),
  };
}

function isStale(attempt: StoredPaymentAttempt, now: Date): boolean {
  return now.getTime() - new Date(attempt.createdAt).getTime() >= STALE_ATTEMPT_MS;
}

export function resolvePaymentAttempt(
  amountRoubles: number,
  dependencies: PaymentAttemptStorageDependencies,
): PaymentAttemptState {
  const stored = readStoredAttempt(dependencies.storage);
  if (!stored) {
    const attempt = createAttempt(amountRoubles, dependencies);
    writeStoredAttempt(dependencies.storage, attempt);
    return { kind: "ready", attempt };
  }

  if (isStale(stored, dependencies.now())) {
    return { kind: "stale-needs-confirmation", attempt: stored };
  }

  if (stored.amountRoubles !== amountRoubles) {
    return { kind: "amount-change-needs-confirmation", attempt: stored };
  }

  return { kind: "ready", attempt: stored };
}

export function beginNewPaymentAttempt(
  amountRoubles: number,
  dependencies: PaymentAttemptStorageDependencies,
): StoredPaymentAttempt {
  const attempt = createAttempt(amountRoubles, dependencies);
  writeStoredAttempt(dependencies.storage, attempt);
  return attempt;
}

export function attachDonationMarker(
  attemptId: string,
  donationId: string,
  dependencies: Pick<PaymentAttemptStorageDependencies, "storage">,
) {
  const stored = readStoredAttempt(dependencies.storage);
  if (!stored || stored.id !== attemptId) {
    return;
  }
  writeStoredAttempt(dependencies.storage, { ...stored, donationId });
}

export function clearPaymentAttempt(
  dependencies: Pick<PaymentAttemptStorageDependencies, "storage">,
) {
  dependencies.storage.removeItem(PAYMENT_ATTEMPT_STORAGE_KEY);
}
