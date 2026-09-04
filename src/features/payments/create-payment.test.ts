import type { Donation } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { createPayment } from "./create-payment";
import { PaymentAttemptConflictError } from "./repository";
import type { PaymentCreateConfig } from "./types";
import {
  YooKassaHttpError,
  YooKassaProtocolError,
  YooKassaUnavailableError,
  type YooKassaPayment,
} from "./yookassa-client";

const ATTEMPT_ID = "f04d0001-0000-4000-8000-000000000001";
const CUSTOMER_EMAIL = "anna@example.org";
const PROVIDER_ID = "provider-payment-1";
const CONFIRMATION_URL =
  "https://yoomoney.ru/checkout/payments/v2/contract?orderId=provider-payment-1";
const NOW = new Date("2026-08-24T18:00:00.000Z");
const TWENTY_THREE_HOURS_MS = 23 * 60 * 60 * 1_000;

const config: PaymentCreateConfig = {
  shopId: "shop-id",
  secretKey: "secret-key",
  siteUrl: new URL("https://example.org"),
  returnUrl: new URL("https://example.org/donation/result"),
  rateLimitSecret: "payment-rate-limit-secret-key-32",
  trustProxy: true,
};

function donation(overrides: Partial<Donation> = {}): Donation {
  return {
    id: ATTEMPT_ID,
    providerPaymentId: null,
    idempotenceKey: ATTEMPT_ID,
    amountKopecks: 30_000,
    currency: "RUB",
    status: "PENDING",
    donorName: null,
    donorEmail: CUSTOMER_EMAIL,
    paidAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function payment(overrides: Partial<YooKassaPayment> = {}): YooKassaPayment {
  return {
    id: PROVIDER_ID,
    status: "pending",
    paid: false,
    amount: { kopecks: 30_000, currency: "RUB" },
    paymentMethod: { type: "sbp" },
    confirmation: { type: "redirect", url: CONFIRMATION_URL },
    capturedAt: undefined,
    metadata: { donationId: ATTEMPT_ID },
    ...overrides,
  };
}

function repositoryFixture(initial: Donation = donation()) {
  let stored: Donation | null = initial;
  const created: Donation[] = [];
  const repository = {
    beginAttempt: vi.fn(async () => {
      const current = stored ?? donation();
      stored = current;
      return created.includes(current)
        ? { kind: "existing" as const, donation: current }
        : { kind: "created" as const, donation: current };
    }),
    findById: vi.fn(async (id: string) => (stored?.id === id ? stored : null)),
    findByProviderPaymentId: vi.fn(),
    bindProviderPaymentId: vi.fn(
      async (id: string, providerPaymentId: string) => {
        if (!stored || stored.id !== id) {
          return { kind: "conflict" as const, donation: null };
        }
        if (stored.providerPaymentId === null) {
          stored = { ...stored, providerPaymentId };
          return { kind: "bound" as const, donation: stored };
        }
        if (stored.providerPaymentId === providerPaymentId) {
          return { kind: "existing" as const, donation: stored };
        }
        return { kind: "conflict" as const, donation: stored };
      },
    ),
    transitionPending: vi.fn(
      async (
        id: string,
        status: "SUCCEEDED" | "CANCELED",
        paidAt: Date | null,
      ) => {
        if (stored?.id === id && stored.status === "PENDING") {
          stored = { ...stored, status, paidAt };
        }
        if (!stored) {
          throw new Error("Donation disappeared.");
        }
        return stored;
      },
    ),
    deleteUnboundPending: vi.fn(async (id: string) => {
      if (
        stored?.id === id &&
        stored.status === "PENDING" &&
        stored.providerPaymentId === null
      ) {
        stored = null;
        return true;
      }
      return false;
    }),
  };

  return {
    get stored() {
      return stored;
    },
    set stored(value: Donation | null) {
      stored = value;
    },
    markExisting() {
      if (stored) {
        created.push(stored);
      }
    },
    repository,
  };
}

function clientFixture(createResult: YooKassaPayment | Error = payment()) {
  return {
    createPayment: vi.fn(async () => {
      if (createResult instanceof Error) {
        throw createResult;
      }
      return createResult;
    }),
    getPayment: vi.fn(async () => {
      if (createResult instanceof Error) {
        throw createResult;
      }
      return createResult;
    }),
  };
}

async function create(input: {
  repository: ReturnType<typeof repositoryFixture>["repository"];
  client?: ReturnType<typeof clientFixture>;
  now?: Date;
}) {
  return createPayment(
    {
      amountKopecks: 30_000,
      attemptId: ATTEMPT_ID,
      customerEmail: CUSTOMER_EMAIL,
      clientKey: "client-key",
    },
    {
      config,
      repository: input.repository,
      client: input.client ?? clientFixture(),
      now: input.now ?? NOW,
    },
  );
}

describe("createPayment happy path", () => {
  it("creates a pending donation and redirects to the authenticated confirmation URL", async () => {
    const fixture = repositoryFixture();
    const client = clientFixture();

    await expect(
      create({ repository: fixture.repository, client }),
    ).resolves.toEqual({
      kind: "redirect",
      url: CONFIRMATION_URL,
      donationId: ATTEMPT_ID,
    });
    expect(fixture.repository.beginAttempt).toHaveBeenCalledExactlyOnceWith({
      attemptId: ATTEMPT_ID,
      amountKopecks: 30_000,
      customerEmail: CUSTOMER_EMAIL,
      clientKey: "client-key",
      now: NOW,
    });
    expect(client.createPayment).toHaveBeenCalledExactlyOnceWith({
      amountKopecks: 30_000,
      donationId: ATTEMPT_ID,
      returnUrl: `https://example.org/donation/result?donation=${ATTEMPT_ID}`,
      customerEmail: CUSTOMER_EMAIL,
    });
    expect(client.getPayment).not.toHaveBeenCalled();
    expect(fixture.stored).toMatchObject({ providerPaymentId: PROVIDER_ID });
  });
});

describe("createPayment retries and races", () => {
  it("repeats POST with the same key for an unbound attempt younger than 23 hours", async () => {
    const createdAt = new Date(NOW.getTime() - TWENTY_THREE_HOURS_MS + 1);
    const fixture = repositoryFixture(donation({ createdAt }));
    fixture.markExisting();
    const client = clientFixture();

    await expect(
      create({ repository: fixture.repository, client }),
    ).resolves.toMatchObject({ kind: "redirect", url: CONFIRMATION_URL });
    expect(client.createPayment).toHaveBeenCalledOnce();
    expect(client.getPayment).not.toHaveBeenCalled();
  });

  it("treats an unbound attempt at exactly 23 hours as stale and never calls the provider", async () => {
    const createdAt = new Date(NOW.getTime() - TWENTY_THREE_HOURS_MS);
    const fixture = repositoryFixture(donation({ createdAt }));
    fixture.markExisting();
    const client = clientFixture();

    await expect(
      create({ repository: fixture.repository, client }),
    ).resolves.toEqual({ kind: "stale-attempt" });
    expect(client.createPayment).not.toHaveBeenCalled();
    expect(client.getPayment).not.toHaveBeenCalled();
    expect(fixture.repository.deleteUnboundPending).not.toHaveBeenCalled();
  });

  it("reconciles a bound attempt through authenticated GET even if it is already terminal", async () => {
    const stored = donation({
      providerPaymentId: PROVIDER_ID,
      status: "SUCCEEDED",
      paidAt: new Date("2026-08-24T18:01:05.000Z"),
    });
    const fixture = repositoryFixture(stored);
    fixture.markExisting();
    const client = clientFixture(
      payment({
        status: "succeeded",
        paid: true,
        confirmation: undefined,
        capturedAt: "2026-08-24T18:01:05.000Z",
      }),
    );

    await expect(
      create({ repository: fixture.repository, client }),
    ).resolves.toEqual({
      kind: "result",
      url: `https://example.org/donation/result?donation=${ATTEMPT_ID}`,
      donationId: ATTEMPT_ID,
    });
    expect(client.createPayment).not.toHaveBeenCalled();
    expect(client.getPayment).toHaveBeenCalledExactlyOnceWith(PROVIDER_ID);
    expect(fixture.repository.transitionPending).not.toHaveBeenCalled();
  });

  it("rejects a pending confirmation URL that is not absolute HTTPS without credentials", async () => {
    const fixture = repositoryFixture();
    const client = clientFixture(
      payment({
        confirmation: {
          type: "redirect",
          url: "http://yoomoney.ru/checkout/payment",
        },
      }),
    );

    await expect(
      create({ repository: fixture.repository, client }),
    ).resolves.toEqual({ kind: "protocol-error" });
    expect(fixture.stored).toMatchObject({
      status: "PENDING",
      providerPaymentId: PROVIDER_ID,
    });
  });

  it("returns the local result URL when create reconciles directly to succeeded", async () => {
    const fixture = repositoryFixture();
    const client = clientFixture(
      payment({
        status: "succeeded",
        paid: true,
        confirmation: undefined,
        capturedAt: "2026-08-24T18:01:05.000Z",
      }),
    );

    await expect(
      create({ repository: fixture.repository, client }),
    ).resolves.toEqual({
      kind: "result",
      url: `https://example.org/donation/result?donation=${ATTEMPT_ID}`,
      donationId: ATTEMPT_ID,
    });
    expect(client.getPayment).not.toHaveBeenCalled();
    expect(fixture.stored).toMatchObject({ status: "SUCCEEDED" });
  });

  it("returns the result URL when an early webhook completes during create", async () => {
    const fixture = repositoryFixture();
    const client = clientFixture();
    fixture.repository.bindProviderPaymentId.mockImplementationOnce(
      async (id: string, providerPaymentId: string) => {
        fixture.stored = donation({
          id,
          providerPaymentId,
          status: "SUCCEEDED",
          paidAt: new Date("2026-08-24T18:01:05.000Z"),
        });
        return { kind: "bound" as const, donation: fixture.stored };
      },
    );

    await expect(
      create({ repository: fixture.repository, client }),
    ).resolves.toEqual({
      kind: "result",
      url: `https://example.org/donation/result?donation=${ATTEMPT_ID}`,
      donationId: ATTEMPT_ID,
    });
    expect(client.createPayment).toHaveBeenCalledOnce();
  });

  it("never calls the provider when the UUID already exists with a different amount", async () => {
    const fixture = repositoryFixture();
    const client = clientFixture();
    fixture.repository.beginAttempt.mockRejectedValueOnce(
      new PaymentAttemptConflictError(),
    );

    await expect(
      create({ repository: fixture.repository, client }),
    ).resolves.toEqual({ kind: "conflict" });
    expect(client.createPayment).not.toHaveBeenCalled();
    expect(client.getPayment).not.toHaveBeenCalled();
  });
});

describe("createPayment provider errors", () => {
  it.each([
    [400, "provider-rejected"],
    [401, "configuration-unavailable"],
    [403, "configuration-unavailable"],
    [404, "provider-endpoint-error"],
    [422, "provider-rejected"],
  ] as const)(
    "deletes an unbound draft after deterministic HTTP %s",
    async (status, kind) => {
      const fixture = repositoryFixture();
      const client = clientFixture(new YooKassaHttpError(status));

      await expect(
        create({ repository: fixture.repository, client }),
      ).resolves.toEqual({ kind });
      expect(fixture.repository.deleteUnboundPending).toHaveBeenCalledExactlyOnceWith(
        ATTEMPT_ID,
      );
      expect(fixture.stored).toBeNull();
    },
  );

  it.each([
    [429, new YooKassaHttpError(429)],
    [500, new YooKassaHttpError(500)],
    ["network", new YooKassaUnavailableError()],
    ["timeout", new YooKassaUnavailableError()],
    ["malformed", new YooKassaProtocolError()],
  ] as const)(
    "preserves the unbound draft after %s",
    async (_name, error) => {
      const fixture = repositoryFixture();
      const client = clientFixture(error);

      await expect(
        create({ repository: fixture.repository, client }),
      ).resolves.toEqual({
        kind:
          error instanceof YooKassaProtocolError
            ? "protocol-error"
            : "provider-unavailable",
      });
      expect(fixture.repository.deleteUnboundPending).not.toHaveBeenCalled();
      expect(fixture.stored).toMatchObject({
        status: "PENDING",
        providerPaymentId: null,
      });
    },
  );

  it("does not start a second attempt if the database fails after the provider responds", async () => {
    const fixture = repositoryFixture();
    const client = clientFixture();
    fixture.repository.bindProviderPaymentId.mockRejectedValueOnce(
      new Error("database unavailable"),
    );

    await expect(
      create({ repository: fixture.repository, client }),
    ).rejects.toThrow("database unavailable");
    expect(fixture.repository.beginAttempt).toHaveBeenCalledOnce();
    expect(fixture.repository.deleteUnboundPending).not.toHaveBeenCalled();
  });
});
