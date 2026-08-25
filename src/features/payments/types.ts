export const supportedYooKassaPaymentMethods = [
  "sbp",
  "bank_card",
  "yoo_money",
] as const;

export type SupportedYooKassaPaymentMethod =
  (typeof supportedYooKassaPaymentMethods)[number];

export function isSupportedYooKassaPaymentMethod(
  type: string,
): type is SupportedYooKassaPaymentMethod {
  return (supportedYooKassaPaymentMethods as readonly string[]).includes(type);
}

export type YooKassaConfig = {
  shopId: string;
  secretKey: string;
};

export type PaymentCreateConfig = YooKassaConfig & {
  siteUrl: URL;
  returnUrl: URL;
  rateLimitSecret: string;
  trustProxy: boolean;
};

export type PaymentCreateInput = {
  amountRoubles: number;
  acceptedOffer: true;
  acceptedPersonalData: true;
  attemptId: string;
  website: "";
};

export type PaymentCreateInputResult =
  | {
      kind: "valid";
      input: PaymentCreateInput;
      amountKopecks: number;
    }
  | { kind: "bot" }
  | { kind: "invalid" };

export type SupportedWebhookEvent =
  | "payment.succeeded"
  | "payment.canceled";

export type WebhookEnvelopeResult =
  | {
      kind: "supported";
      event: SupportedWebhookEvent;
      paymentId: string;
    }
  | { kind: "unsupported-type" }
  | { kind: "unsupported-event" }
  | { kind: "malformed" };
