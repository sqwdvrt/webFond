import { describe, expect, it } from "vitest";

import {
  parsePaymentCreateInput,
  parseWebhookEnvelope,
} from "@/features/payments/validation";

const validInput = {
  amountRoubles: 300,
  acceptedOffer: true,
  acceptedPersonalData: true,
  attemptId: "123e4567-e89b-42d3-a456-426614174000",
  website: "",
} as const;

describe("parsePaymentCreateInput", () => {
  it.each([100, 300, 500, 1_000, 100_000])(
    "accepts preset and boundary amount %d",
    (amountRoubles) => {
      expect(
        parsePaymentCreateInput({ ...validInput, amountRoubles }),
      ).toEqual({
        kind: "valid",
        input: { ...validInput, amountRoubles },
        amountKopecks: amountRoubles * 100,
      });
    },
  );

  it("accepts every integer amount in the allowed range", () => {
    for (let amountRoubles = 100; amountRoubles <= 100_000; amountRoubles += 1) {
      expect(
        parsePaymentCreateInput({ ...validInput, amountRoubles }).kind,
      ).toBe("valid");
    }
  });

  it.each([
    99,
    100_001,
    100.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
    "100",
    "1e2",
    true,
  ])("rejects invalid amount %s", (amountRoubles) => {
    expect(
      parsePaymentCreateInput({ ...validInput, amountRoubles }),
    ).toEqual({ kind: "invalid" });
  });

  it("requires literal offer and personal data acceptance", async () => {
    expect(
      parsePaymentCreateInput({ ...validInput, acceptedOffer: false }),
    ).toEqual({ kind: "invalid" });
    expect(
      parsePaymentCreateInput({ ...validInput, acceptedPersonalData: false }),
    ).toEqual({ kind: "invalid" });
    expect(
      parsePaymentCreateInput({
        amountRoubles: 300,
        acceptedOffer: true,
        attemptId: validInput.attemptId,
        website: "",
      }),
    ).toEqual({ kind: "invalid" });
  });

  it.each([
    "123e4567-e89b-12d3-a456-426614174000",
    "123e4567-e89b-42d3-7456-426614174000",
    "not-a-uuid",
    "a".repeat(1_000),
  ])("rejects a non-v4 or oversized attempt ID: %s", (attemptId) => {
    expect(
      parsePaymentCreateInput({ ...validInput, attemptId }),
    ).toEqual({ kind: "invalid" });
  });

  it("rejects missing and extra fields", () => {
    const withoutWebsite = {
      amountRoubles: validInput.amountRoubles,
      acceptedOffer: validInput.acceptedOffer,
      acceptedPersonalData: validInput.acceptedPersonalData,
      attemptId: validInput.attemptId,
    };

    expect(parsePaymentCreateInput(withoutWebsite)).toEqual({
      kind: "invalid",
    });
    expect(
      parsePaymentCreateInput({ ...validInput, unexpected: "value" }),
    ).toEqual({ kind: "invalid" });
  });

  it("returns a distinct bot result for a non-empty honeypot", () => {
    expect(
      parsePaymentCreateInput({ ...validInput, website: "spam.example" }),
    ).toEqual({ kind: "bot" });
  });

  it.each([null, [], "payload", true])(
    "rejects non-object payload %s",
    (payload) => {
      expect(parsePaymentCreateInput(payload)).toEqual({ kind: "invalid" });
    },
  );
});

describe("parseWebhookEnvelope", () => {
  it.each(["payment.succeeded", "payment.canceled"] as const)(
    "accepts supported event %s and trusts only its payment ID",
    (event) => {
      expect(
        parseWebhookEnvelope({
          type: "notification",
          event,
          object: {
            id: "provider-payment-id",
            status: "succeeded",
            amount: { value: "999999.00" },
          },
          extra: "ignored",
        }),
      ).toEqual({
        kind: "supported",
        event,
        paymentId: "provider-payment-id",
      });
    },
  );

  it("distinguishes unsupported notification types", () => {
    expect(
      parseWebhookEnvelope({
        type: "ping",
        event: "payment.succeeded",
        object: { id: "provider-payment-id" },
      }),
    ).toEqual({ kind: "unsupported-type" });
  });

  it("distinguishes unsupported well-formed events", () => {
    expect(
      parseWebhookEnvelope({
        type: "notification",
        event: "refund.succeeded",
        object: { id: "provider-payment-id" },
      }),
    ).toEqual({ kind: "unsupported-event" });
  });

  it.each([
    " provider-payment-id",
    "provider-payment-id ",
    "\tprovider-payment-id",
    "provider-payment-id\n",
  ])("rejects payment IDs with boundary whitespace: %j", (id) => {
    expect(
      parseWebhookEnvelope({
        type: "notification",
        event: "payment.succeeded",
        object: { id },
      }),
    ).toEqual({ kind: "malformed" });
  });

  it.each([
    null,
    [],
    {},
    { type: 1, event: "payment.succeeded", object: { id: "payment-id" } },
    { type: "notification", event: 1, object: { id: "payment-id" } },
    { type: "notification", event: "payment.succeeded" },
    { type: "notification", event: "payment.succeeded", object: null },
    { type: "notification", event: "payment.succeeded", object: { id: "" } },
    { type: "notification", event: "payment.succeeded", object: { id: 1 } },
  ])("returns malformed for invalid envelope shape: %s", (payload) => {
    expect(parseWebhookEnvelope(payload)).toEqual({ kind: "malformed" });
  });
});
