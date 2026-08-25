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
