import { PrismaClient } from "@prisma/client";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  PaymentRateLimitedError,
  paymentLimitKeys,
} from "./rate-limit";
import {
  PaymentAttemptConflictError,
  createPaymentRepository,
} from "./repository";
import { requireSafePaymentsTestDatabaseUrl } from "./test-database-url";

const HOOK_TIMEOUT_MS = 20_000;
const TEST_TIMEOUT_MS = 20_000;
const CLIENT_WINDOW_MS = 10 * 60 * 1_000;
const GLOBAL_WINDOW_MS = 60 * 1_000;
const FIXTURE_ATTEMPT_PREFIX = "f04d";
const FIXTURE_DONATION_PREFIX = "payments-integration-";
const NOW = new Date("2026-08-24T20:40:00.000Z");
const CAPTURED_AT = new Date("2026-08-24T20:41:05.000Z");
const FIXTURE_CLIENT_KEYS = {
  concurrent: "integration-client-concurrent",
  conflict: "integration-client-conflict",
  limits: {
    clientRequests: "integration-client-limit-client-requests",
    clientAttempts: "integration-client-limit-client-attempts",
    globalRequests: "integration-client-limit-global-requests",
    globalAttempts: "integration-client-limit-global-attempts",
  },
  expiry: "integration-client-expiry",
} as const;
const EXPIRED_FIXTURE_KEYS = ["payments:integration:expired"] as const;
const OWNED_CLIENT_KEYS = [
  FIXTURE_CLIENT_KEYS.concurrent,
  FIXTURE_CLIENT_KEYS.conflict,
  ...Object.values(FIXTURE_CLIENT_KEYS.limits),
  FIXTURE_CLIENT_KEYS.expiry,
] as const;

function bucketKeysForClient(clientKey: string): string[] {
  return Object.values(paymentLimitKeys(clientKey)) as string[];
}

const OWNED_BUCKET_KEYS = [
  ...new Set([
    ...OWNED_CLIENT_KEYS.flatMap(bucketKeysForClient),
    ...EXPIRED_FIXTURE_KEYS,
  ]),
];

function attemptId(sequence: number): string {
  return `f04d${sequence.toString().padStart(4, "0")}-0000-4000-8000-${sequence
    .toString()
    .padStart(12, "0")}`;
}

function windowStart(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

function expiresAt(start: Date, windowMs: number): Date {
  return new Date(start.getTime() + windowMs);
}

const verifiedDatabaseUrl = requireSafePaymentsTestDatabaseUrl();
const client = new PrismaClient({
  datasources: { db: { url: verifiedDatabaseUrl } },
});
const repository = createPaymentRepository(client);

async function cleanupTestState() {
  await client.$transaction([
    client.paymentRateLimitBucket.deleteMany({
      where: { key: { in: OWNED_BUCKET_KEYS } },
    }),
    client.donation.deleteMany({
      where: {
        OR: [
          { id: { startsWith: FIXTURE_DONATION_PREFIX } },
          { idempotenceKey: { startsWith: FIXTURE_ATTEMPT_PREFIX } },
        ],
      },
    }),
  ]);
}

async function createPendingDonation(sequence: number) {
  return client.donation.create({
    data: {
      id: `${FIXTURE_DONATION_PREFIX}${sequence}`,
      idempotenceKey: attemptId(sequence),
      amountKopecks: 50_000,
      currency: "RUB",
      status: "PENDING",
    },
  });
}

async function bucketCount(key: string, start: Date): Promise<number | null> {
  const bucket = await client.paymentRateLimitBucket.findUnique({
    where: {
      key_windowStart: {
        key,
        windowStart: start,
      },
    },
  });
  return bucket?.count ?? null;
}

beforeAll(async () => {
  await client.$connect();
  await cleanupTestState();
}, HOOK_TIMEOUT_MS);

beforeEach(cleanupTestState, HOOK_TIMEOUT_MS);
afterEach(cleanupTestState, HOOK_TIMEOUT_MS);

afterAll(async () => {
  try {
    await cleanupTestState();
  } finally {
    await client.$disconnect();
  }
}, HOOK_TIMEOUT_MS);

describe("payment repository against PostgreSQL", () => {
  it(
    "serializes concurrent attempts and charges request quota twice but new-attempt quota once",
    async () => {
      const id = attemptId(1);
      const clientKey = FIXTURE_CLIENT_KEYS.concurrent;
      const keys = paymentLimitKeys(clientKey);

      const results = await Promise.all([
        repository.beginAttempt({
          attemptId: id,
          amountKopecks: 50_000,
          clientKey,
          now: NOW,
        }),
        repository.beginAttempt({
          attemptId: id,
          amountKopecks: 50_000,
          clientKey,
          now: NOW,
        }),
      ]);

      expect([results[0].kind, results[1].kind].sort()).toEqual([
        "created",
        "existing",
      ]);
      expect(
        new Set([results[0].donation.id, results[1].donation.id]).size,
      ).toBe(1);
      await expect(
        client.donation.count({ where: { idempotenceKey: id } }),
      ).resolves.toBe(1);

      const clientStart = windowStart(NOW, CLIENT_WINDOW_MS);
      const globalStart = windowStart(NOW, GLOBAL_WINDOW_MS);
      await expect(
        Promise.all([
          bucketCount(keys.clientRequests, clientStart),
          bucketCount(keys.clientAttempts, clientStart),
          bucketCount(keys.globalRequests, globalStart),
          bucketCount(keys.globalAttempts, globalStart),
        ]),
      ).resolves.toEqual([2, 1, 2, 1]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "commits request quota but not new-attempt quota for a conflicting retry",
    async () => {
      const id = attemptId(17);
      const clientKey = FIXTURE_CLIENT_KEYS.conflict;
      const keys = paymentLimitKeys(clientKey);

      await repository.beginAttempt({
        attemptId: id,
        amountKopecks: 50_000,
        clientKey,
        now: NOW,
      });
      await expect(
        repository.beginAttempt({
          attemptId: id,
          amountKopecks: 50_001,
          clientKey,
          now: NOW,
        }),
      ).rejects.toBeInstanceOf(PaymentAttemptConflictError);

      const clientStart = windowStart(NOW, CLIENT_WINDOW_MS);
      const globalStart = windowStart(NOW, GLOBAL_WINDOW_MS);
      await expect(
        Promise.all([
          bucketCount(keys.clientRequests, clientStart),
          bucketCount(keys.clientAttempts, clientStart),
          bucketCount(keys.globalRequests, globalStart),
          bucketCount(keys.globalAttempts, globalStart),
        ]),
      ).resolves.toEqual([2, 1, 2, 1]);
      await expect(
        client.donation.findUniqueOrThrow({ where: { id } }),
      ).resolves.toMatchObject({
        amountKopecks: 50_000,
        currency: "RUB",
      });
    },
    TEST_TIMEOUT_MS,
  );

  it.each([
    {
      name: "20 client requests per ten minutes",
      keyName: "clientRequests" as const,
      limit: 20,
      windowMs: CLIENT_WINDOW_MS,
      retryAfterSeconds: 600,
    },
    {
      name: "5 new client attempts per ten minutes",
      keyName: "clientAttempts" as const,
      limit: 5,
      windowMs: CLIENT_WINDOW_MS,
      retryAfterSeconds: 600,
    },
    {
      name: "300 global requests per minute",
      keyName: "globalRequests" as const,
      limit: 300,
      windowMs: GLOBAL_WINDOW_MS,
      retryAfterSeconds: 60,
    },
    {
      name: "100 new global attempts per minute",
      keyName: "globalAttempts" as const,
      limit: 100,
      windowMs: GLOBAL_WINDOW_MS,
      retryAfterSeconds: 60,
    },
  ])(
    "enforces $name and rolls the entire limited transaction back",
    async ({ keyName, limit, retryAfterSeconds, windowMs }) => {
      const sequence =
        {
          clientRequests: 2,
          clientAttempts: 3,
          globalRequests: 4,
          globalAttempts: 5,
        }[keyName];
      const id = attemptId(sequence);
      const clientKey = FIXTURE_CLIENT_KEYS.limits[keyName];
      const key = paymentLimitKeys(clientKey)[keyName];
      const start = windowStart(NOW, windowMs);

      await client.paymentRateLimitBucket.create({
        data: {
          key,
          windowStart: start,
          count: limit,
          expiresAt: expiresAt(start, windowMs),
        },
      });

      const error = await repository
        .beginAttempt({
          attemptId: id,
          amountKopecks: 30_000,
          clientKey,
          now: NOW,
        })
        .then(
          () => null,
          (caught: unknown) => caught,
        );

      expect(error).toBeInstanceOf(PaymentRateLimitedError);
      expect(error).toMatchObject({ retryAfterSeconds });
      await expect(
        client.donation.count({ where: { idempotenceKey: id } }),
      ).resolves.toBe(0);
      await expect(
        client.paymentRateLimitBucket.findMany({
          where: { key: { in: OWNED_BUCKET_KEYS } },
          select: { key: true, count: true, windowStart: true },
        }),
      ).resolves.toEqual([{ key, count: limit, windowStart: start }]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "binds a provider ID conditionally and accepts an idempotent repeat",
    async () => {
      const donation = await createPendingDonation(10);

      const first = await repository.bindProviderPaymentId(
        donation.id,
        "provider-conditional-a",
      );
      const repeated = await repository.bindProviderPaymentId(
        donation.id,
        "provider-conditional-a",
      );
      const conflicting = await repository.bindProviderPaymentId(
        donation.id,
        "provider-conditional-b",
      );

      expect(first.kind).not.toBe("conflict");
      expect(repeated.kind).not.toBe("conflict");
      expect(conflicting.kind).toBe("conflict");
      await expect(
        client.donation.findUniqueOrThrow({ where: { id: donation.id } }),
      ).resolves.toMatchObject({
        providerPaymentId: "provider-conditional-a",
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "enforces provider ID uniqueness across concurrent bindings",
    async () => {
      const firstDonation = await createPendingDonation(11);
      const secondDonation = await createPendingDonation(12);
      const providerId = "provider-unique-concurrent";

      const results = await Promise.all([
        repository.bindProviderPaymentId(firstDonation.id, providerId),
        repository.bindProviderPaymentId(secondDonation.id, providerId),
      ]);

      expect(
        Number(results[0].kind === "conflict") +
          Number(results[1].kind === "conflict"),
      ).toBe(1);
      await expect(
        client.donation.count({ where: { providerPaymentId: providerId } }),
      ).resolves.toBe(1);
      await expect(
        client.donation.count({
          where: {
            id: { in: [firstDonation.id, secondDonation.id] },
            providerPaymentId: null,
          },
        }),
      ).resolves.toBe(1);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "keeps an early webhook-style binding when create later binds the same ID",
    async () => {
      const donation = await createPendingDonation(13);
      const providerId = "provider-early-webhook";

      const webhookBind = await repository.bindProviderPaymentId(
        donation.id,
        providerId,
      );
      const createResponseBind = await repository.bindProviderPaymentId(
        donation.id,
        providerId,
      );

      expect(webhookBind.kind).not.toBe("conflict");
      expect(createResponseBind.kind).not.toBe("conflict");
      await expect(
        client.donation.findUniqueOrThrow({ where: { id: donation.id } }),
      ).resolves.toMatchObject({ providerPaymentId: providerId });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "allows only one concurrent terminal transition",
    async () => {
      const donation = await createPendingDonation(14);

      const results = await Promise.all([
        repository.transitionPending(
          donation.id,
          "SUCCEEDED",
          CAPTURED_AT,
        ),
        repository.transitionPending(donation.id, "CANCELED", null),
      ]);
      const stored = await client.donation.findUniqueOrThrow({
        where: { id: donation.id },
      });

      expect(["SUCCEEDED", "CANCELED"]).toContain(stored.status);
      expect([results[0].status, results[1].status]).toEqual([
        stored.status,
        stored.status,
      ]);
      expect(stored.paidAt).toEqual(
        stored.status === "SUCCEEDED" ? CAPTURED_AT : null,
      );
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "never overwrites a successful donation with canceled",
    async () => {
      const donation = await createPendingDonation(15);

      await repository.transitionPending(
        donation.id,
        "SUCCEEDED",
        CAPTURED_AT,
      );
      const replay = await repository.transitionPending(
        donation.id,
        "CANCELED",
        null,
      );

      expect(replay).toMatchObject({
        status: "SUCCEEDED",
        paidAt: CAPTURED_AT,
      });
      await expect(
        client.donation.findUniqueOrThrow({ where: { id: donation.id } }),
      ).resolves.toMatchObject({
        status: "SUCCEEDED",
        paidAt: CAPTURED_AT,
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "removes expired buckets after a successful attempt",
    async () => {
      const expiredKey = EXPIRED_FIXTURE_KEYS[0];
      await client.paymentRateLimitBucket.create({
        data: {
          key: expiredKey,
          windowStart: new Date(NOW.getTime() - GLOBAL_WINDOW_MS * 2),
          count: 1,
          expiresAt: new Date(NOW.getTime() - 1),
        },
      });

      await repository.beginAttempt({
        attemptId: attemptId(16),
        amountKopecks: 100_000,
        clientKey: FIXTURE_CLIENT_KEYS.expiry,
        now: NOW,
      });

      await expect(
        client.paymentRateLimitBucket.count({
          where: { key: expiredKey },
        }),
      ).resolves.toBe(0);
    },
    TEST_TIMEOUT_MS,
  );
});
