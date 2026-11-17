import { personalDataConsentPublication } from "@/content/legal";
import { donationOfferPublication } from "@/content/donation-offer";
import { defaultSaveContact } from "@/features/contact/submit";
import { createPayment } from "./create-payment";

import { PrismaClient } from "@prisma/client";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
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
  it("keeps legacy evidence null and atomically stores contact consent", async () => {
    const legacy = await createPendingDonation(901);
    expect(legacy).toMatchObject({ consentVersion: null, consentAcceptedAt: null, offerVersion: null, offerAcceptedAt: null });
    const legacyContact = await client.contactRequest.create({ data: { name: "Legacy consent integration", email: "legacy-consent@example.test", message: "Historical message" } });
    try {
      expect(legacyContact).toMatchObject({ consentVersion: null, consentAcceptedAt: null });
      await defaultSaveContact({ name: "Current consent integration", email: "current-consent@example.test", message: "Current message", consentVersion: personalDataConsentPublication.version, consentAcceptedAt: NOW }, "consent-integration", NOW, client as never);
      expect(await client.contactRequest.findFirstOrThrow({ where: { email: "current-consent@example.test" } })).toMatchObject({ consentVersion: personalDataConsentPublication.version, consentAcceptedAt: NOW });
      expect(await client.contactRequest.findUniqueOrThrow({ where: { id: legacyContact.id } })).toMatchObject({ consentVersion: null, consentAcceptedAt: null });
    } finally {
      await client.contactRequest.deleteMany({ where: { email: { in: ["legacy-consent@example.test", "current-consent@example.test"] } } });
      await client.paymentRateLimitBucket.deleteMany({ where: { key: { in: ["contact:client:10m:consent-integration", "contact:global:1m"] } } });
    }
  }, TEST_TIMEOUT_MS);

  it("stores donation evidence and reuses a bound payment after document versions change", async () => {
    const id = attemptId(902);
    const command = { attemptId: id, amountKopecks: 30_000, customerEmail: "anna@example.org", clientKey: FIXTURE_CLIENT_KEYS.concurrent, acceptedPersonalData: true, consentVersion: personalDataConsentPublication.version, acceptedOffer: true, offerVersion: donationOfferPublication.version! };
    const payment = { id: "consent-provider-payment", status: "pending" as const, paid: false, amount: { kopecks: 30_000, currency: "RUB" }, paymentMethod: { type: "sbp" }, confirmation: { type: "redirect" as const, url: "https://yoomoney.ru/checkout/consent" }, capturedAt: undefined, metadata: { donationId: id } };
    const provider = { createPayment: vi.fn(async () => payment), getPayment: vi.fn(async () => payment) };
    const dependencies = { repository, client: provider, now: NOW, config: { shopId: "test", secretKey: "test", siteUrl: new URL("https://example.org"), returnUrl: new URL("https://example.org/donation/result"), rateLimitSecret: "test-secret-long-enough-for-local-tests", trustProxy: false } };
    expect(await createPayment(command, dependencies)).toMatchObject({ kind: "redirect", donationId: id });
    const original = await client.donation.findUniqueOrThrow({ where: { id } });
    expect(original).toMatchObject({ consentVersion: command.consentVersion, consentAcceptedAt: NOW, offerVersion: command.offerVersion, offerAcceptedAt: NOW });
    const originalConsentVersion = personalDataConsentPublication.version;
    const originalOfferVersion = donationOfferPublication.version;
    try {
      personalDataConsentPublication.version = "future-consent";
      donationOfferPublication.version = "future-offer";
      expect(await createPayment(command, { ...dependencies, now: new Date(NOW.getTime() + 1000) })).toMatchObject({ kind: "redirect", donationId: id });
      expect(provider.createPayment).toHaveBeenCalledOnce();
      expect(provider.getPayment).toHaveBeenCalledOnce();
      expect(await client.donation.findUniqueOrThrow({ where: { id } })).toMatchObject({ consentVersion: original.consentVersion, consentAcceptedAt: original.consentAcceptedAt, offerVersion: original.offerVersion, offerAcceptedAt: original.offerAcceptedAt });
      expect(await createPayment({ ...command, attemptId: attemptId(903) }, dependencies)).toEqual({ kind: "consent-required" });
      expect(await client.donation.findUnique({ where: { id: attemptId(903) } })).toBeNull();
      expect(provider.createPayment).toHaveBeenCalledOnce();
      expect(await createPayment({ ...command, customerEmail: "other@example.org" }, dependencies)).toEqual({ kind: "conflict" });
    } finally {
      personalDataConsentPublication.version = originalConsentVersion;
      donationOfferPublication.version = originalOfferVersion;
    }
  }, TEST_TIMEOUT_MS);

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
          customerEmail: "anna@example.org",
        acceptedPersonalData: true, consentVersion: "2026-09-04",
        acceptedOffer: true, offerVersion: "2026-09-04",
          clientKey,
          now: NOW,
        }),
        repository.beginAttempt({
          attemptId: id,
          amountKopecks: 50_000,
          customerEmail: "anna@example.org",
        acceptedPersonalData: true, consentVersion: "2026-09-04",
        acceptedOffer: true, offerVersion: "2026-09-04",
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
        customerEmail: "anna@example.org",
        acceptedPersonalData: true, consentVersion: "2026-09-04",
        acceptedOffer: true, offerVersion: "2026-09-04",
        clientKey,
        now: NOW,
      });
      await expect(
        repository.beginAttempt({
          attemptId: id,
          amountKopecks: 50_001,
          customerEmail: "anna@example.org",
        acceptedPersonalData: true, consentVersion: "2026-09-04",
        acceptedOffer: true, offerVersion: "2026-09-04",
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
          customerEmail: "anna@example.org",
        acceptedPersonalData: true, consentVersion: "2026-09-04",
        acceptedOffer: true, offerVersion: "2026-09-04",
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
        customerEmail: "anna@example.org",
        acceptedPersonalData: true, consentVersion: "2026-09-04",
        acceptedOffer: true, offerVersion: "2026-09-04",
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
