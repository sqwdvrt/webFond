import type { Donation } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  defaultPaymentAlertReporter,
  paymentAlertCodes,
  type PaymentAlertCode,
} from "./alerts";
import {
  reconcilePaymentById,
  reconcileRetryCodes,
  reconcileVerifiedPayment,
} from "./reconcile";
import {
  YooKassaHttpError,
  YooKassaProtocolError,
  YooKassaUnavailableError,
  type YooKassaPayment,
} from "./yookassa-client";

const PAYMENT_ID = "provider-payment-1";
const DONATION_ID = "f04d0001-0000-4000-8000-000000000001";
const NOW = new Date("2026-08-24T18:00:00.000Z");

function payment(
  overrides: Partial<YooKassaPayment> = {},
): YooKassaPayment {
  return {
    id: PAYMENT_ID,
    status: "pending",
    paid: false,
    amount: { kopecks: 30_000, currency: "RUB" },
    paymentMethod: { type: "sbp" },
    confirmation: {
      type: "redirect",
      url: "https://yoomoney.ru/checkout/payment",
    },
    capturedAt: undefined,
    metadata: { donationId: DONATION_ID },
    ...overrides,
  };
}

function donation(overrides: Partial<Donation> = {}): Donation {
  return {
    id: DONATION_ID,
    providerPaymentId: null,
    idempotenceKey: DONATION_ID,
    amountKopecks: 30_000,
    currency: "RUB",
    status: "PENDING",
    donorName: null,
    donorEmail: null,
    paidAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    projectId: null,
    ...overrides,
  };
}

function repositoryFixture(initial: Donation | null = donation()) {
  let stored = initial;
  const repository = {
    findById: vi.fn(async (id: string) =>
      stored?.id === id ? stored : null,
    ),
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
  };

  return {
    get stored() {
      return stored;
    },
    repository,
  };
}

function expectNoMutation(
  repository: ReturnType<typeof repositoryFixture>["repository"],
) {
  expect(repository.bindProviderPaymentId).not.toHaveBeenCalled();
  expect(repository.transitionPending).not.toHaveBeenCalled();
}

async function expectPermanentRejection({
  alertCode,
  initial = donation(),
  providerPayment = payment(),
  expectedPaymentId,
}: {
  alertCode: PaymentAlertCode;
  initial?: Donation | null;
  providerPayment?: YooKassaPayment;
  expectedPaymentId?: string;
}) {
  const report = vi.fn();
  const fixture = repositoryFixture(initial);
  const before = fixture.stored;

  await expect(
    reconcileVerifiedPayment(
      {
        payment: providerPayment,
        terminalEvent: null,
        expectedPaymentId,
      },
      { repository: fixture.repository, report },
    ),
  ).resolves.toEqual({ kind: "permanent-rejection", alertCode });
  expectNoMutation(fixture.repository);
  expect(fixture.stored).toBe(before);
  expect(report).toHaveBeenCalledExactlyOnceWith(alertCode);
}

describe("reconcileVerifiedPayment", () => {
  it("permanently rejects a payment whose local donation is missing", async () => {
    await expectPermanentRejection({
      alertCode: paymentAlertCodes.localDonationMissing,
      initial: null,
    });
  });

  it("permanently rejects a returned payment ID mismatch", async () => {
    await expectPermanentRejection({
      alertCode: paymentAlertCodes.paymentIdMismatch,
      expectedPaymentId: "expected-provider-payment",
    });
  });

  it("permanently rejects malformed payment metadata", async () => {
    await expectPermanentRejection({
      alertCode: paymentAlertCodes.metadataMismatch,
      providerPayment: payment({ metadata: { donationId: " " } }),
    });
  });

  it.each([
    {
      name: "amount",
      providerPayment: payment({
        amount: { kopecks: 30_001, currency: "RUB" },
      }),
      alertCode: paymentAlertCodes.amountMismatch,
    },
    {
      name: "currency",
      providerPayment: payment({
        amount: { kopecks: 30_000, currency: "USD" },
      }),
      alertCode: paymentAlertCodes.currencyMismatch,
    },
    {
      name: "payment method",
      providerPayment: payment({ paymentMethod: { type: "sberbank" } }),
      alertCode: paymentAlertCodes.paymentMethodMismatch,
    },
    {
      name: "missing terminal payment method",
      providerPayment: payment({
        status: "succeeded",
        paid: true,
        capturedAt: "2026-08-24T18:05:04.321Z",
        paymentMethod: undefined,
        confirmation: undefined,
      }),
      alertCode: paymentAlertCodes.paymentMethodMismatch,
    },
  ])(
    "permanently rejects a $name mismatch before binding",
    async ({ alertCode, providerPayment }) => {
      await expectPermanentRejection({ alertCode, providerPayment });
    },
  );

  it("permanently rejects a different provider ID already bound locally", async () => {
    await expectPermanentRejection({
      alertCode: paymentAlertCodes.providerPaymentIdConflict,
      initial: donation({ providerPaymentId: "another-provider-payment" }),
    });
  });
});

describe("reconcilePaymentById permanent provider errors", () => {
  it.each([
    [400, paymentAlertCodes.invalidProviderSignal],
    [404, paymentAlertCodes.providerPaymentMissing],
  ] as const)("maps GET %s to one fixed permanent alert", async (status, alertCode) => {
    const report = vi.fn();
    const fixture = repositoryFixture();
    const client = {
      getPayment: vi.fn().mockRejectedValue(new YooKassaHttpError(status)),
    };

    await expect(
      reconcilePaymentById(
        { paymentId: PAYMENT_ID, terminalEvent: "payment.succeeded" },
        { client, repository: fixture.repository, report },
      ),
    ).resolves.toEqual({ kind: "permanent-rejection", alertCode });
    expect(client.getPayment).toHaveBeenCalledExactlyOnceWith(PAYMENT_ID);
    expectNoMutation(fixture.repository);
    expect(report).toHaveBeenCalledExactlyOnceWith(alertCode);
  });
});

describe("provider payment binding", () => {
  it("binds an early provider ID before returning pending", async () => {
    const fixture = repositoryFixture();

    await expect(
      reconcileVerifiedPayment(
        { payment: payment(), terminalEvent: null },
        { repository: fixture.repository },
      ),
    ).resolves.toEqual({
      kind: "pending",
      donation: expect.objectContaining({ providerPaymentId: PAYMENT_ID }),
      confirmationUrl: "https://yoomoney.ru/checkout/payment",
    });
    expect(fixture.repository.bindProviderPaymentId).toHaveBeenCalledExactlyOnceWith(
      DONATION_ID,
      PAYMENT_ID,
    );
    expect(fixture.repository.transitionPending).not.toHaveBeenCalled();
    expect(fixture.stored).toMatchObject({ providerPaymentId: PAYMENT_ID });
  });

  it("accepts a pending payment before a method is chosen", async () => {
    const fixture = repositoryFixture();

    await expect(
      reconcileVerifiedPayment(
        {
          payment: payment({ paymentMethod: undefined }),
          terminalEvent: null,
        },
        { repository: fixture.repository },
      ),
    ).resolves.toMatchObject({ kind: "pending" });
  });

  it.each(["sbp", "bank_card", "yoo_money"] as const)(
    "accepts payment method %s",
    async (type) => {
      const fixture = repositoryFixture();

      await expect(
        reconcileVerifiedPayment(
          {
            payment: payment({ paymentMethod: { type } }),
            terminalEvent: null,
          },
          { repository: fixture.repository },
        ),
      ).resolves.toMatchObject({ kind: "pending" });
    },
  );

  it("accepts the same provider ID on replay", async () => {
    const stored = donation({ providerPaymentId: PAYMENT_ID });
    const fixture = repositoryFixture(stored);

    await expect(
      reconcileVerifiedPayment(
        {
          payment: payment({ confirmation: undefined }),
          terminalEvent: null,
        },
        { repository: fixture.repository },
      ),
    ).resolves.toEqual({
      kind: "pending",
      donation: stored,
      confirmationUrl: null,
    });
    expect(fixture.stored).toBe(stored);
    expect(fixture.repository.transitionPending).not.toHaveBeenCalled();
  });

  it("binds before retrying a terminal webhook whose GET remains pending", async () => {
    const fixture = repositoryFixture();

    await expect(
      reconcileVerifiedPayment(
        {
          payment: payment(),
          terminalEvent: "payment.succeeded",
        },
        { repository: fixture.repository },
      ),
    ).resolves.toEqual({
      kind: "retry",
      code: "payment_provider_pending",
    });
    expect(fixture.stored).toMatchObject({ providerPaymentId: PAYMENT_ID });
    expect(fixture.repository.transitionPending).not.toHaveBeenCalled();
  });

  it("permanently rejects a different provider ID won by a bind race", async () => {
    const report = vi.fn();
    const fixture = repositoryFixture();
    const raced = donation({ providerPaymentId: "race-winner" });
    fixture.repository.bindProviderPaymentId.mockImplementationOnce(
      async () => ({ kind: "conflict" as const, donation: raced }),
    );

    await expect(
      reconcileVerifiedPayment(
        { payment: payment(), terminalEvent: null },
        { repository: fixture.repository, report },
      ),
    ).resolves.toEqual({
      kind: "permanent-rejection",
      alertCode: paymentAlertCodes.providerPaymentIdConflict,
    });
    expect(fixture.repository.transitionPending).not.toHaveBeenCalled();
    expect(fixture.stored).toEqual(donation());
    expect(report).toHaveBeenCalledExactlyOnceWith(
      paymentAlertCodes.providerPaymentIdConflict,
    );
  });
});

describe("status matrix", () => {
  it("transitions a paid succeeded payment using captured_at", async () => {
    const fixture = repositoryFixture();
    const capturedAt = "2026-08-24T18:01:05.000Z";

    await expect(
      reconcileVerifiedPayment(
        {
          payment: payment({
            status: "succeeded",
            paid: true,
            confirmation: undefined,
            capturedAt,
          }),
          terminalEvent: "payment.succeeded",
        },
        { repository: fixture.repository },
      ),
    ).resolves.toEqual({
      kind: "succeeded",
      donation: expect.objectContaining({
        status: "SUCCEEDED",
        paidAt: new Date(capturedAt),
        providerPaymentId: PAYMENT_ID,
      }),
    });
    expect(fixture.repository.transitionPending).toHaveBeenCalledExactlyOnceWith(
      DONATION_ID,
      "SUCCEEDED",
      new Date(capturedAt),
    );
  });

  it("applies an authenticated succeeded GET even if the event name is stale", async () => {
    const fixture = repositoryFixture();
    const capturedAt = "2026-08-24T18:01:05.000Z";

    await expect(
      reconcileVerifiedPayment(
        {
          payment: payment({
            status: "succeeded",
            paid: true,
            confirmation: undefined,
            capturedAt,
          }),
          terminalEvent: "payment.canceled",
        },
        { repository: fixture.repository },
      ),
    ).resolves.toMatchObject({ kind: "succeeded" });
    expect(fixture.stored).toMatchObject({ status: "SUCCEEDED" });
  });

  it("transitions canceled without setting paidAt", async () => {
    const fixture = repositoryFixture();

    await expect(
      reconcileVerifiedPayment(
        {
          payment: payment({
            status: "canceled",
            confirmation: undefined,
          }),
          terminalEvent: "payment.canceled",
        },
        { repository: fixture.repository },
      ),
    ).resolves.toEqual({
      kind: "canceled",
      donation: expect.objectContaining({
        status: "CANCELED",
        paidAt: null,
        providerPaymentId: PAYMENT_ID,
      }),
    });
    expect(fixture.repository.transitionPending).toHaveBeenCalledExactlyOnceWith(
      DONATION_ID,
      "CANCELED",
      null,
    );
  });

  it("treats replay of an already succeeded donation as a no-op", async () => {
    const capturedAt = new Date("2026-08-24T18:01:05.000Z");
    const stored = donation({
      providerPaymentId: PAYMENT_ID,
      status: "SUCCEEDED",
      paidAt: capturedAt,
    });
    const fixture = repositoryFixture(stored);

    await expect(
      reconcileVerifiedPayment(
        {
          payment: payment({
            status: "succeeded",
            paid: true,
            confirmation: undefined,
            capturedAt: capturedAt.toISOString(),
          }),
          terminalEvent: "payment.succeeded",
        },
        { repository: fixture.repository },
      ),
    ).resolves.toEqual({ kind: "succeeded", donation: stored });
    expect(fixture.repository.transitionPending).not.toHaveBeenCalled();
    expect(fixture.stored).toBe(stored);
  });

  it("permanently rejects a conflicting remote terminal status", async () => {
    const report = vi.fn();
    const stored = donation({
      providerPaymentId: PAYMENT_ID,
      status: "SUCCEEDED",
      paidAt: new Date("2026-08-24T18:01:05.000Z"),
    });
    const fixture = repositoryFixture(stored);

    await expect(
      reconcileVerifiedPayment(
        {
          payment: payment({
            status: "canceled",
            confirmation: undefined,
          }),
          terminalEvent: "payment.canceled",
        },
        { repository: fixture.repository, report },
      ),
    ).resolves.toEqual({
      kind: "permanent-rejection",
      alertCode: paymentAlertCodes.terminalStateConflict,
    });
    expect(fixture.repository.transitionPending).not.toHaveBeenCalled();
    expect(fixture.stored).toBe(stored);
    expect(report).toHaveBeenCalledExactlyOnceWith(
      paymentAlertCodes.terminalStateConflict,
    );
  });

  it.each([
    {
      name: "waiting_for_capture",
      providerPayment: payment({ status: "waiting_for_capture" }),
      code: reconcileRetryCodes.captureInvariant,
    },
    {
      name: "unknown status",
      providerPayment: payment({ status: "unknown" }),
      code: reconcileRetryCodes.providerProtocol,
    },
    {
      name: "succeeded without paid",
      providerPayment: payment({
        status: "succeeded",
        paid: false,
        capturedAt: "2026-08-24T18:01:05.000Z",
      }),
      code: reconcileRetryCodes.providerProtocol,
    },
    {
      name: "succeeded without captured_at",
      providerPayment: payment({ status: "succeeded", paid: true }),
      code: reconcileRetryCodes.providerProtocol,
    },
    {
      name: "succeeded with invalid captured_at",
      providerPayment: payment({
        status: "succeeded",
        paid: true,
        capturedAt: "not-a-date",
      }),
      code: reconcileRetryCodes.providerProtocol,
    },
  ])("retries $name without changing status", async ({ code, providerPayment }) => {
    const fixture = repositoryFixture();

    await expect(
      reconcileVerifiedPayment(
        { payment: providerPayment, terminalEvent: "payment.succeeded" },
        { repository: fixture.repository },
      ),
    ).resolves.toEqual({ kind: "retry", code });
    expect(fixture.repository.transitionPending).not.toHaveBeenCalled();
    expect(fixture.stored).toMatchObject({
      status: "PENDING",
      providerPaymentId: PAYMENT_ID,
    });
  });
});

describe("reconcilePaymentById retryable provider errors", () => {
  it.each([
    [401, reconcileRetryCodes.providerConfiguration],
    [403, reconcileRetryCodes.providerConfiguration],
    [429, reconcileRetryCodes.providerUnavailable],
    [500, reconcileRetryCodes.providerUnavailable],
  ] as const)("maps GET %s to a retryable outcome", async (status, code) => {
    const fixture = repositoryFixture();
    const client = {
      getPayment: vi.fn().mockRejectedValue(new YooKassaHttpError(status)),
    };

    await expect(
      reconcilePaymentById(
        { paymentId: PAYMENT_ID, terminalEvent: "payment.succeeded" },
        { client, repository: fixture.repository },
      ),
    ).resolves.toEqual({ kind: "retry", code });
    expectNoMutation(fixture.repository);
  });

  it("retries a network failure without mutating the donation", async () => {
    const fixture = repositoryFixture();
    const client = {
      getPayment: vi.fn().mockRejectedValue(new YooKassaUnavailableError()),
    };

    await expect(
      reconcilePaymentById(
        { paymentId: PAYMENT_ID, terminalEvent: null },
        { client, repository: fixture.repository },
      ),
    ).resolves.toEqual({
      kind: "retry",
      code: reconcileRetryCodes.providerUnavailable,
    });
    expectNoMutation(fixture.repository);
  });

  it("retries a malformed GET without mutating the donation", async () => {
    const fixture = repositoryFixture();
    const client = {
      getPayment: vi.fn().mockRejectedValue(new YooKassaProtocolError()),
    };

    await expect(
      reconcilePaymentById(
        { paymentId: PAYMENT_ID, terminalEvent: "payment.succeeded" },
        { client, repository: fixture.repository },
      ),
    ).resolves.toEqual({
      kind: "retry",
      code: reconcileRetryCodes.providerProtocol,
    });
    expectNoMutation(fixture.repository);
  });
});

describe("payment alerts", () => {
  it("logs only the fixed alert code", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    defaultPaymentAlertReporter("payment_local_donation_missing");

    expect(error).toHaveBeenCalledExactlyOnceWith(
      "payment_local_donation_missing",
    );
    error.mockRestore();
  });
});
