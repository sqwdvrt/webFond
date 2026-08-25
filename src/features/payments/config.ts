import {
  donationOfferPublication,
  type DonationOfferPublication,
} from "@/content/donation-offer";
import { evaluatePaymentsGate } from "@/features/payments/gate";
import type {
  PaymentCreateConfig,
  YooKassaConfig,
} from "@/features/payments/types";

type PaymentsEnvironment = Readonly<Record<string, string | undefined>>;

type PaymentsConfigurationErrorCode =
  | "payments-disabled"
  | "yookassa-credentials"
  | "payment-create-secret"
  | "payment-create-url"
  | "payment-create-proxy";

const ERROR_MESSAGES: Record<PaymentsConfigurationErrorCode, string> = {
  "payments-disabled": "Payment creation is disabled.",
  "yookassa-credentials": "YooKassa credentials are not configured.",
  "payment-create-secret": "Payment rate limiting is not configured.",
  "payment-create-url": "Payment URLs are not configured correctly.",
  "payment-create-proxy": "Payment proxy trust is not configured correctly.",
};

export class PaymentsConfigurationError extends Error {
  constructor(
    public readonly code: PaymentsConfigurationErrorCode,
  ) {
    super(ERROR_MESSAGES[code]);
    this.name = "PaymentsConfigurationError";
  }
}

function readRequired(
  env: PaymentsEnvironment,
  name: string,
  code: PaymentsConfigurationErrorCode,
): string {
  const value = env[name]?.trim();

  if (!value) {
    throw new PaymentsConfigurationError(code);
  }

  return value;
}

function readUrl(
  env: PaymentsEnvironment,
  name: string,
): URL {
  const value = readRequired(env, name, "payment-create-url");

  try {
    return new URL(value);
  } catch {
    throw new PaymentsConfigurationError("payment-create-url");
  }
}

function hasSensitiveUrlParts(url: URL): boolean {
  return Boolean(url.username || url.password || url.search || url.hash);
}

function isLocalEnvironment(environment: string | undefined): boolean {
  return environment === "development" || environment === "test";
}

export function readPaymentsAvailability(
  env: PaymentsEnvironment = process.env,
  offer: DonationOfferPublication = donationOfferPublication,
) {
  return evaluatePaymentsGate({
    enabledValue: env.PAYMENTS_ENABLED,
    configuredOfferVersion: env.PAYMENTS_OFFER_VERSION,
    offer,
  });
}

export function readYooKassaConfig(
  env: PaymentsEnvironment = process.env,
): YooKassaConfig {
  return {
    shopId: readRequired(env, "YOOKASSA_SHOP_ID", "yookassa-credentials"),
    secretKey: readRequired(
      env,
      "YOOKASSA_SECRET_KEY",
      "yookassa-credentials",
    ),
  };
}

export function readPaymentCreateConfig(
  env: PaymentsEnvironment = process.env,
  offer: DonationOfferPublication = donationOfferPublication,
): PaymentCreateConfig {
  if (!readPaymentsAvailability(env, offer).enabled) {
    throw new PaymentsConfigurationError("payments-disabled");
  }

  const yooKassa = readYooKassaConfig(env);
  const siteUrl = readUrl(env, "SITE_URL");
  const returnUrl = readUrl(env, "YOOKASSA_RETURN_URL");
  const rateLimitSecret = readRequired(
    env,
    "PAYMENTS_RATE_LIMIT_SECRET",
    "payment-create-secret",
  );

  if (rateLimitSecret.length < 32) {
    throw new PaymentsConfigurationError("payment-create-secret");
  }

  if (
    env.PAYMENTS_TRUST_PROXY !== "true" &&
    env.PAYMENTS_TRUST_PROXY !== "false"
  ) {
    throw new PaymentsConfigurationError("payment-create-proxy");
  }

  const trustProxy = env.PAYMENTS_TRUST_PROXY === "true";

  if (
    hasSensitiveUrlParts(siteUrl) ||
    hasSensitiveUrlParts(returnUrl) ||
    siteUrl.origin !== returnUrl.origin ||
    returnUrl.pathname !== "/donation/result"
  ) {
    throw new PaymentsConfigurationError("payment-create-url");
  }

  const requiresProductionSafeguards = !isLocalEnvironment(env.NODE_ENV);

  if (
    requiresProductionSafeguards &&
    (siteUrl.protocol !== "https:" || returnUrl.protocol !== "https:")
  ) {
    throw new PaymentsConfigurationError("payment-create-url");
  }

  if (requiresProductionSafeguards && !trustProxy) {
    throw new PaymentsConfigurationError("payment-create-proxy");
  }

  return {
    ...yooKassa,
    siteUrl,
    returnUrl,
    rateLimitSecret,
    trustProxy,
  };
}
