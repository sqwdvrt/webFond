import { PaymentRateLimitedError } from "./rate-limit";
import {
  reconcilePaymentById,
  reconcileVerifiedPayment,
  type ReconcileOutcome,
} from "./reconcile";
import {
  PaymentAttemptConflictError,
  type PaymentRepository,
} from "./repository";
import type { PaymentCreateConfig } from "./types";
import {
  YooKassaHttpError,
  YooKassaProtocolError,
  YooKassaUnavailableError,
  type YooKassaClient,
} from "./yookassa-client";

const STALE_ATTEMPT_MS = 23 * 60 * 60 * 1_000;

export type CreatePaymentCommand = {
  amountKopecks: number;
  attemptId: string;
  clientKey: string;
};

export type CreatePaymentOutcome =
  | { kind: "redirect"; url: string; donationId: string }
  | { kind: "result"; url: string; donationId: string }
  | { kind: "stale-attempt" }
  | { kind: "conflict" }
  | { kind: "rate-limited"; retryAfterSeconds: number }
  | { kind: "provider-rejected" }
  | { kind: "configuration-unavailable" }
  | { kind: "provider-endpoint-error" }
  | { kind: "provider-unavailable" }
  | { kind: "protocol-error" };

export type CreatePaymentDependencies = {
  config: PaymentCreateConfig;
  repository: PaymentRepository;
  client: Pick<YooKassaClient, "createPayment" | "getPayment">;
  now: Date;
};

function withDonationParam(returnUrl: URL, donationId: string): string {
  const url = new URL(returnUrl.href);
  url.searchParams.set("donation", donationId);
  return url.toString();
}

function isAllowedConfirmationUrl(value: string | null): value is string {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname !== "" &&
      parsed.username === "" &&
      parsed.password === ""
    );
  } catch {
    return false;
  }
}

function isStale(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() >= STALE_ATTEMPT_MS;
}

function mapReconcileOutcome(
  outcome: ReconcileOutcome,
  returnUrl: URL,
  donationId: string,
): CreatePaymentOutcome {
  if (outcome.kind === "succeeded" || outcome.kind === "canceled") {
    return {
      kind: "result",
      url: withDonationParam(returnUrl, donationId),
      donationId,
    };
  }

  if (outcome.kind === "pending") {
    if (!isAllowedConfirmationUrl(outcome.confirmationUrl)) {
      return { kind: "protocol-error" };
    }

    return {
      kind: "redirect",
      url: outcome.confirmationUrl,
      donationId,
    };
  }

  if (outcome.kind === "permanent-rejection") {
    return { kind: "conflict" };
  }

  return { kind: "provider-unavailable" };
}

async function mapCreateError(
  error: unknown,
  repository: PaymentRepository,
  donationId: string,
): Promise<CreatePaymentOutcome> {
  if (error instanceof YooKassaHttpError) {
    if (error.status === 401 || error.status === 403) {
      await repository.deleteUnboundPending(donationId);
      return { kind: "configuration-unavailable" };
    }
    if (error.status === 404) {
      await repository.deleteUnboundPending(donationId);
      return { kind: "provider-endpoint-error" };
    }
    if (error.status === 429 || error.status >= 500) {
      return { kind: "provider-unavailable" };
    }
    if (error.status >= 400 && error.status < 500) {
      await repository.deleteUnboundPending(donationId);
      return { kind: "provider-rejected" };
    }
  }

  if (error instanceof YooKassaUnavailableError) {
    return { kind: "provider-unavailable" };
  }

  if (error instanceof YooKassaProtocolError) {
    return { kind: "protocol-error" };
  }

  throw error;
}

export async function createPayment(
  command: CreatePaymentCommand,
  { client, config, now, repository }: CreatePaymentDependencies,
): Promise<CreatePaymentOutcome> {
  let attempt;

  try {
    attempt = await repository.beginAttempt({
      attemptId: command.attemptId,
      amountKopecks: command.amountKopecks,
      clientKey: command.clientKey,
      now,
    });
  } catch (error) {
    if (error instanceof PaymentAttemptConflictError) {
      return { kind: "conflict" };
    }
    if (error instanceof PaymentRateLimitedError) {
      return {
        kind: "rate-limited",
        retryAfterSeconds: error.retryAfterSeconds,
      };
    }
    throw error;
  }

  const donation = attempt.donation;

  if (donation.providerPaymentId) {
    const outcome = await reconcilePaymentById(
      { paymentId: donation.providerPaymentId, terminalEvent: null },
      { client, repository },
    );
    return mapReconcileOutcome(outcome, config.returnUrl, donation.id);
  }

  if (attempt.kind === "existing" && isStale(donation.createdAt, now)) {
    return { kind: "stale-attempt" };
  }

  let createdPayment;

  try {
    createdPayment = await client.createPayment({
      amountKopecks: command.amountKopecks,
      donationId: donation.id,
      returnUrl: withDonationParam(config.returnUrl, donation.id),
    });
  } catch (error) {
    return mapCreateError(error, repository, donation.id);
  }

  const outcome = await reconcileVerifiedPayment(
    { payment: createdPayment, terminalEvent: null },
    { repository },
  );
  const latest = await repository.findById(donation.id);

  if (latest?.status === "SUCCEEDED" || latest?.status === "CANCELED") {
    return {
      kind: "result",
      url: withDonationParam(config.returnUrl, donation.id),
      donationId: donation.id,
    };
  }

  return mapReconcileOutcome(outcome, config.returnUrl, donation.id);
}
