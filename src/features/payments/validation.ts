import type {
  PaymentCreateInput,
  PaymentCreateInputResult,
  SupportedWebhookEvent,
  WebhookEnvelopeResult,
} from "@/features/payments/types";

const PAYMENT_INPUT_KEYS = [
  "acceptedOffer",
  "acceptedPersonalData",
  "amountRoubles",
  "attemptId",
  "website",
] as const;

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SUPPORTED_WEBHOOK_EVENTS = new Set<SupportedWebhookEvent>([
  "payment.succeeded",
  "payment.canceled",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactPaymentInputKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === PAYMENT_INPUT_KEYS.length &&
    PAYMENT_INPUT_KEYS.every((key) => Object.hasOwn(value, key))
  );
}

export function parsePaymentCreateInput(
  value: unknown,
): PaymentCreateInputResult {
  if (!isObject(value)) {
    return { kind: "invalid" };
  }

  if (typeof value.website === "string" && value.website !== "") {
    return { kind: "bot" };
  }

  if (
    !hasExactPaymentInputKeys(value) ||
    value.website !== "" ||
    value.acceptedOffer !== true ||
    value.acceptedPersonalData !== true ||
    typeof value.attemptId !== "string" ||
    !UUID_V4_PATTERN.test(value.attemptId) ||
    typeof value.amountRoubles !== "number" ||
    !Number.isSafeInteger(value.amountRoubles) ||
    value.amountRoubles < 100 ||
    value.amountRoubles > 100_000
  ) {
    return { kind: "invalid" };
  }

  const input: PaymentCreateInput = {
    amountRoubles: value.amountRoubles,
    acceptedOffer: true,
    acceptedPersonalData: true,
    attemptId: value.attemptId,
    website: "",
  };

  return {
    kind: "valid",
    input,
    amountKopecks: input.amountRoubles * 100,
  };
}

export function parseWebhookEnvelope(
  value: unknown,
): WebhookEnvelopeResult {
  if (!isObject(value) || typeof value.type !== "string") {
    return { kind: "malformed" };
  }

  if (value.type !== "notification") {
    return { kind: "unsupported-type" };
  }

  if (
    typeof value.event !== "string" ||
    !isObject(value.object) ||
    typeof value.object.id !== "string" ||
    value.object.id.trim().length === 0 ||
    value.object.id.trim() !== value.object.id ||
    value.object.id.length > 256
  ) {
    return { kind: "malformed" };
  }

  if (!SUPPORTED_WEBHOOK_EVENTS.has(value.event as SupportedWebhookEvent)) {
    return { kind: "unsupported-event" };
  }

  return {
    kind: "supported",
    event: value.event as SupportedWebhookEvent,
    paymentId: value.object.id,
  };
}
