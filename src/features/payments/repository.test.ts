import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

const productionClient = vi.hoisted(() => ({
  $transaction: vi.fn(),
  donation: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  paymentRateLimitBucket: {
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: productionClient }));

import { paymentLimitKeys } from "./rate-limit";
import {
  PaymentAttemptConflictError,
  createPaymentRepository,
  paymentRepository,
} from "./repository";

const NOW = new Date("2026-08-24T20:40:00.000Z");
const PAID_AT = new Date("2026-08-24T20:41:05.000Z");
const ATTEMPT_ID = "f04d0001-0000-4000-8000-000000000001";

function donation(
  overrides: Partial<{
    id: string;
    providerPaymentId: string | null;
    idempotenceKey: string;
    amountKopecks: number;
    currency: string;
    status: "PENDING" | "SUCCEEDED" | "CANCELED";
    paidAt: Date | null;
  }> = {},
) {
  return {
    id: "donation-1",
    providerPaymentId: null,
    idempotenceKey: ATTEMPT_ID,
    amountKopecks: 50_000,
    currency: "RUB",
    status: "PENDING" as const,
    donorName: null,
    donorEmail: null,
    paidAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function repositoryFixture(existing: ReturnType<typeof donation> | null = null) {
  const rawCalls: Array<{ sql: string; values: unknown[] }> = [];
  const tx = {
    $queryRaw: vi.fn(
      (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.join("");
        rawCalls.push({ sql, values });
        if (!sql.includes("INSERT INTO")) {
          return Promise.reject(new Error("cannot deserialize void"));
        }
        return Promise.resolve([{ count: 1 }]);
      },
    ),
    $executeRaw: vi.fn(
      (strings: TemplateStringsArray, ...values: unknown[]) => {
        rawCalls.push({ sql: strings.join(""), values });
        return Promise.resolve(1);
      },
    ),
    donation: {
      findUnique: vi.fn().mockResolvedValue(existing),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  const client = {
    $transaction: vi.fn(
      async (operation: (transaction: typeof tx) => Promise<unknown>) =>
        operation(tx),
    ),
    donation: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    paymentRateLimitBucket: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };

  return {
    client,
    rawCalls,
    repository: createPaymentRepository(
      client as unknown as PrismaClient,
    ),
    tx,
  };
}

describe("beginAttempt", () => {
  it("returns a matching existing attempt without consuming new-attempt quota", async () => {
    const stored = donation();
    const { client, rawCalls, repository, tx } = repositoryFixture(stored);

    await expect(
      repository.beginAttempt({
        attemptId: ATTEMPT_ID,
        amountKopecks: 50_000,
        clientKey: "client-17",
        now: NOW,
      }),
    ).resolves.toEqual({ kind: "existing", donation: stored });

    expect(client.$transaction).toHaveBeenCalledOnce();
    expect(tx.donation.create).not.toHaveBeenCalled();
    expect(rawCalls.filter(({ sql }) => sql.includes("INSERT INTO"))).toHaveLength(
      2,
    );
    expect(rawCalls.map(({ values }) => values[0])).toEqual([
      paymentLimitKeys("client-17").clientRequests,
      paymentLimitKeys("client-17").globalRequests,
      ATTEMPT_ID,
    ]);
  });

  it("rejects a reused attempt ID with a different amount using a typed conflict", async () => {
    const { client, repository, tx } = repositoryFixture(donation());

    await expect(
      repository.beginAttempt({
        attemptId: ATTEMPT_ID,
        amountKopecks: 50_001,
        clientKey: "client-17",
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(PaymentAttemptConflictError);
    expect(tx.donation.create).not.toHaveBeenCalled();
    expect(client.paymentRateLimitBucket.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lte: NOW } },
    });
  });

  it("consumes all four buckets and creates a supplied UUID pending RUB donation", async () => {
    const created = donation();
    const { rawCalls, repository, tx } = repositoryFixture();
    tx.donation.create.mockResolvedValue(created);

    await expect(
      repository.beginAttempt({
        attemptId: ATTEMPT_ID,
        amountKopecks: 50_000,
        clientKey: "client-17",
        now: NOW,
      }),
    ).resolves.toEqual({ kind: "created", donation: created });

    expect(
      rawCalls
        .filter(({ sql }) => sql.includes("INSERT INTO"))
        .map(({ values }) => values[0]),
    ).toEqual([
      paymentLimitKeys("client-17").clientRequests,
      paymentLimitKeys("client-17").globalRequests,
      paymentLimitKeys("client-17").clientAttempts,
      paymentLimitKeys("client-17").globalAttempts,
    ]);
    expect(tx.donation.create).toHaveBeenCalledWith({
      data: {
        id: ATTEMPT_ID,
        idempotenceKey: ATTEMPT_ID,
        amountKopecks: 50_000,
        currency: "RUB",
        status: "PENDING",
      },
    });
  });

  it("runs expired-bucket cleanup after success and ignores cleanup failure", async () => {
    const created = donation();
    const { client, repository, tx } = repositoryFixture();
    tx.donation.create.mockResolvedValue(created);
    client.paymentRateLimitBucket.deleteMany.mockRejectedValue(
      new Error("cleanup unavailable"),
    );

    await expect(
      repository.beginAttempt({
        attemptId: ATTEMPT_ID,
        amountKopecks: 50_000,
        clientKey: "client-17",
        now: NOW,
      }),
    ).resolves.toEqual({ kind: "created", donation: created });
    expect(client.paymentRateLimitBucket.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lte: NOW } },
    });
    expect(
      client.paymentRateLimitBucket.deleteMany.mock.invocationCallOrder[0],
    ).toBeGreaterThan(client.$transaction.mock.invocationCallOrder[0]);
  });
});

describe("repository reads and conditional writes", () => {
  it("exports a production repository backed by the db singleton", async () => {
    const stored = donation();
    productionClient.donation.findUnique.mockResolvedValueOnce(stored);

    await expect(paymentRepository.findById(stored.id)).resolves.toBe(stored);
    expect(productionClient.donation.findUnique).toHaveBeenCalledWith({
      where: { id: stored.id },
    });
  });

  it("finds donations by local and provider IDs on the supplied client", async () => {
    const stored = donation({ providerPaymentId: "provider-1" });
    const { client, repository } = repositoryFixture();
    client.donation.findUnique.mockResolvedValue(stored);

    await expect(repository.findById(stored.id)).resolves.toBe(stored);
    await expect(
      repository.findByProviderPaymentId("provider-1"),
    ).resolves.toBe(stored);
    expect(client.donation.findUnique).toHaveBeenNthCalledWith(1, {
      where: { id: stored.id },
    });
    expect(client.donation.findUnique).toHaveBeenNthCalledWith(2, {
      where: { providerPaymentId: "provider-1" },
    });
  });

  it("binds only a null provider ID and re-reads the row", async () => {
    const stored = donation({ providerPaymentId: "provider-1" });
    const { client, repository } = repositoryFixture();
    client.donation.updateMany.mockResolvedValue({ count: 1 });
    client.donation.findUnique.mockResolvedValue(stored);

    await expect(
      repository.bindProviderPaymentId(stored.id, "provider-1"),
    ).resolves.toEqual({ kind: "bound", donation: stored });
    expect(client.donation.updateMany).toHaveBeenCalledWith({
      where: { id: stored.id, providerPaymentId: null },
      data: { providerPaymentId: "provider-1" },
    });
  });

  it("reports repeat bindings as existing and different bindings as conflicts", async () => {
    const stored = donation({ providerPaymentId: "provider-1" });
    const { client, repository } = repositoryFixture();
    client.donation.updateMany.mockResolvedValue({ count: 0 });
    client.donation.findUnique.mockResolvedValueOnce(stored);

    await expect(
      repository.bindProviderPaymentId(stored.id, "provider-1"),
    ).resolves.toEqual({ kind: "existing", donation: stored });

    client.donation.findUnique.mockResolvedValueOnce(stored);
    await expect(
      repository.bindProviderPaymentId(stored.id, "provider-2"),
    ).resolves.toEqual({ kind: "conflict", donation: stored });
  });

  it("turns a provider uniqueness race into a conflict after re-reading", async () => {
    const stored = donation();
    const { client, repository } = repositoryFixture();
    client.donation.updateMany.mockRejectedValue({ code: "P2002" });
    client.donation.findUnique.mockResolvedValue(stored);

    await expect(
      repository.bindProviderPaymentId(stored.id, "already-used"),
    ).resolves.toEqual({ kind: "conflict", donation: stored });
  });

  it("conditionally transitions pending rows and returns the stored terminal state", async () => {
    const succeeded = donation({ status: "SUCCEEDED", paidAt: PAID_AT });
    const { client, repository } = repositoryFixture();
    client.donation.updateMany.mockResolvedValue({ count: 1 });
    client.donation.findUniqueOrThrow.mockResolvedValue(succeeded);

    await expect(
      repository.transitionPending(succeeded.id, "SUCCEEDED", PAID_AT),
    ).resolves.toBe(succeeded);
    expect(client.donation.updateMany).toHaveBeenCalledWith({
      where: { id: succeeded.id, status: "PENDING" },
      data: { status: "SUCCEEDED", paidAt: PAID_AT },
    });

    client.donation.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      repository.transitionPending(succeeded.id, "CANCELED", null),
    ).resolves.toBe(succeeded);
  });

  it("deletes only unbound pending rows", async () => {
    const { client, repository } = repositoryFixture();
    client.donation.deleteMany.mockResolvedValue({ count: 1 });

    await expect(repository.deleteUnboundPending("donation-1")).resolves.toBe(
      true,
    );
    expect(client.donation.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "donation-1",
        status: "PENDING",
        providerPaymentId: null,
      },
    });
  });
});
