import { describe, expect, it } from "vitest";

import {
  PAYMENT_ATTEMPT_STORAGE_KEY,
  attachDonationMarker,
  beginNewPaymentAttempt,
  clearPaymentAttempt,
  resolvePaymentAttempt,
} from "./attempt-storage";

const NOW = new Date("2026-08-24T18:00:00.000Z");
const UUID_A = "f04d0001-0000-4000-8000-000000000001";
const UUID_B = "f04d0002-0000-4000-8000-000000000002";

function memoryStorage(initial?: string): Storage {
  const data = new Map<string, string>();
  if (initial !== undefined) {
    data.set(PAYMENT_ATTEMPT_STORAGE_KEY, initial);
  }
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key) {
      return data.get(key) ?? null;
    },
    key(index) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key) {
      data.delete(key);
    },
    setItem(key, value) {
      data.set(key, value);
    },
  };
}

function deps(options: {
  storage?: Storage;
  uuid?: string;
  now?: Date;
} = {}) {
  let uuid = options.uuid ?? UUID_A;
  return {
    storage: options.storage ?? memoryStorage(),
    randomUUID: () => uuid,
    now: () => options.now ?? NOW,
    setUuid(next: string) {
      uuid = next;
    },
  };
}

describe("resolvePaymentAttempt", () => {
  it("creates and reuses an attempt for the same amount on reload", () => {
    const storage = memoryStorage();
    const first = resolvePaymentAttempt(500, deps({ storage }));
    const second = resolvePaymentAttempt(500, deps({ storage, uuid: UUID_B }));

    expect(first).toEqual({
      kind: "ready",
      attempt: {
        version: 1,
        id: UUID_A,
        amountRoubles: 500,
        createdAt: NOW.toISOString(),
      },
    });
    expect(second).toEqual(first);
  });

  it("requires confirmation before replacing the amount", () => {
    const storage = memoryStorage();
    resolvePaymentAttempt(500, deps({ storage }));

    expect(resolvePaymentAttempt(1000, deps({ storage, uuid: UUID_B }))).toEqual({
      kind: "amount-change-needs-confirmation",
      attempt: {
        version: 1,
        id: UUID_A,
        amountRoubles: 500,
        createdAt: NOW.toISOString(),
      },
    });
    expect(storage.getItem(PAYMENT_ATTEMPT_STORAGE_KEY)).toContain(UUID_A);
  });

  it("keeps a 23-hour-old UUID and never auto-creates a new one", () => {
    const createdAt = new Date(NOW.getTime() - 23 * 60 * 60 * 1_000);
    const storage = memoryStorage(
      JSON.stringify({
        version: 1,
        id: UUID_A,
        amountRoubles: 500,
        createdAt: createdAt.toISOString(),
      }),
    );

    expect(resolvePaymentAttempt(500, deps({ storage, uuid: UUID_B }))).toEqual({
      kind: "stale-needs-confirmation",
      attempt: {
        version: 1,
        id: UUID_A,
        amountRoubles: 500,
        createdAt: createdAt.toISOString(),
      },
    });
    expect(storage.getItem(PAYMENT_ATTEMPT_STORAGE_KEY)).toContain(UUID_A);
    expect(storage.getItem(PAYMENT_ATTEMPT_STORAGE_KEY)).not.toContain(UUID_B);
  });

  it("treats corrupt storage as empty and creates a fresh attempt", () => {
    const storage = memoryStorage("{not json");

    expect(resolvePaymentAttempt(300, deps({ storage }))).toMatchObject({
      kind: "ready",
      attempt: { id: UUID_A, amountRoubles: 300 },
    });
  });
});

describe("beginNewPaymentAttempt and cleanup", () => {
  it("replaces a stored attempt only after an explicit new start", () => {
    const storage = memoryStorage();
    resolvePaymentAttempt(500, deps({ storage }));

    const started = beginNewPaymentAttempt(1000, deps({ storage, uuid: UUID_B }));

    expect(started).toEqual({
      version: 1,
      id: UUID_B,
      amountRoubles: 1000,
      createdAt: NOW.toISOString(),
    });
    expect(JSON.parse(storage.getItem(PAYMENT_ATTEMPT_STORAGE_KEY) ?? "{}").id)
      .toBe(UUID_B);
  });

  it("attaches a donation marker only to the matching attempt", () => {
    const storage = memoryStorage();
    resolvePaymentAttempt(500, deps({ storage }));

    attachDonationMarker(UUID_B, "donation-other", deps({ storage }));
    expect(JSON.parse(storage.getItem(PAYMENT_ATTEMPT_STORAGE_KEY) ?? "{}"))
      .not.toHaveProperty("donationId");

    attachDonationMarker(UUID_A, "donation-local", deps({ storage }));
    expect(JSON.parse(storage.getItem(PAYMENT_ATTEMPT_STORAGE_KEY) ?? "{}"))
      .toMatchObject({ id: UUID_A, donationId: "donation-local" });
  });

  it("clears a terminal attempt", () => {
    const storage = memoryStorage();
    resolvePaymentAttempt(500, deps({ storage }));
    clearPaymentAttempt(deps({ storage }));
    expect(storage.getItem(PAYMENT_ATTEMPT_STORAGE_KEY)).toBeNull();
  });
});
