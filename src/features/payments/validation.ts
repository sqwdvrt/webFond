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
  "email",
  "projectSlug",
  "website",
] as const;

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROJECT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/;
const EMAIL_LOCAL_PART_PATTERN =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;

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

function textLength(value: string) {
  return Array.from(value).length;
}

function isBasicEmail(value: string) {
  if (textLength(value) < 3 || textLength(value) > 254 || /\s/u.test(value)) {
    return false;
  }

  const parts = value.split("@");
  if (parts.length !== 2) {
    return false;
  }

  const [local, domain] = parts;
  if (!local || !domain || !EMAIL_LOCAL_PART_PATTERN.test(local)) {
    return false;
  }

  return domain.split(".").every(
    (label) =>
      label.length <= 63 &&
      /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label),
  );
}

export function normalizeDonorEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (CONTROL_CHARACTER_PATTERN.test(email) || !isBasicEmail(email)) {
    return null;
  }
  return email;
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
    typeof value.email !== "string" ||
    typeof value.projectSlug !== "string" ||
    (value.projectSlug !== "" &&
      (textLength(value.projectSlug) > 120 ||
        !PROJECT_SLUG_PATTERN.test(value.projectSlug))) ||
    typeof value.amountRoubles !== "number" ||
    !Number.isSafeInteger(value.amountRoubles) ||
    value.amountRoubles < 100 ||
    value.amountRoubles > 100_000
  ) {
    return { kind: "invalid" };
  }

  const email = normalizeDonorEmail(value.email);
  if (!email) {
    return { kind: "invalid" };
  }

  const input: PaymentCreateInput = {
    amountRoubles: value.amountRoubles,
    acceptedOffer: true,
    acceptedPersonalData: true,
    attemptId: value.attemptId,
    email,
    website: "",
    projectSlug: value.projectSlug,
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
