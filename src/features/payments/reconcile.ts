import type { Donation } from "@prisma/client";

import {
  defaultPaymentAlertReporter,
  paymentAlertCodes,
  type PaymentAlertCode,
  type PaymentAlertReporter,
} from "./alerts";
import type { PaymentRepository } from "./repository";
import {
  isSupportedYooKassaPaymentMethod,
  type SupportedWebhookEvent,
} from "./types";
import {
  YooKassaHttpError,
  YooKassaProtocolError,
  YooKassaUnavailableError,
  type YooKassaClient,
  type YooKassaPayment,
} from "./yookassa-client";

export const reconcileRetryCodes = {
  providerPending: "payment_provider_pending",
  captureInvariant: "payment_capture_invariant",
  providerProtocol: "payment_provider_protocol",
  providerConfiguration: "payment_provider_configuration",
  providerUnavailable: "payment_provider_unavailable",
  databaseUnavailable: "payment_database_unavailable",
} as const;

export type ReconcileRetryCode =
  (typeof reconcileRetryCodes)[keyof typeof reconcileRetryCodes];

export type ReconcileOutcome =
  | {
      kind: "pending";
      donation: Donation;
      confirmationUrl: string | null;
    }
  | { kind: "succeeded"; donation: Donation }
  | { kind: "canceled"; donation: Donation }
  | { kind: "retry"; code: ReconcileRetryCode }
  | { kind: "permanent-rejection"; alertCode: PaymentAlertCode };

type ReconcileRepository = Pick<
  PaymentRepository,
  "findById" | "bindProviderPaymentId" | "transitionPending"
>;

export type ReconcileVerifiedPaymentDependencies = {
  repository: ReconcileRepository;
  report?: PaymentAlertReporter;
};

type ReconcileVerifiedPaymentInput = {
  payment: YooKassaPayment;
  terminalEvent: SupportedWebhookEvent | null;
  expectedPaymentId?: string;
};

type ReconcilePaymentByIdInput = {
  paymentId: string;
  terminalEvent: SupportedWebhookEvent | null;
};

export type ReconcilePaymentByIdDependencies =
  ReconcileVerifiedPaymentDependencies & {
    client: Pick<YooKassaClient, "getPayment">;
  };

function permanentRejection(
  alertCode: PaymentAlertCode,
  report: PaymentAlertReporter,
): ReconcileOutcome {
  report(alertCode);
  return { kind: "permanent-rejection", alertCode };
}

function isNonblankString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export async function reconcileVerifiedPayment(
  { payment, terminalEvent, expectedPaymentId }: ReconcileVerifiedPaymentInput,
  {
    repository,
    report = defaultPaymentAlertReporter,
  }: ReconcileVerifiedPaymentDependencies,
): Promise<ReconcileOutcome> {
  if (
    !isNonblankString(payment.id) ||
    (expectedPaymentId !== undefined && payment.id !== expectedPaymentId)
  ) {
    return permanentRejection(paymentAlertCodes.paymentIdMismatch, report);
  }

  if (!isNonblankString(payment.metadata?.donationId)) {
    return permanentRejection(paymentAlertCodes.metadataMismatch, report);
  }

  const donation = await repository.findById(payment.metadata.donationId);

  if (!donation) {
    return permanentRejection(
      paymentAlertCodes.localDonationMissing,
      report,
    );
  }

  if (payment.amount?.kopecks !== donation.amountKopecks) {
    return permanentRejection(paymentAlertCodes.amountMismatch, report);
  }
  if (payment.amount.currency !== "RUB" || donation.currency !== "RUB") {
    return permanentRejection(paymentAlertCodes.currencyMismatch, report);
  }
  const paymentMethodType = payment.paymentMethod?.type;
  if (paymentMethodType !== undefined) {
    if (!isSupportedYooKassaPaymentMethod(paymentMethodType)) {
      return permanentRejection(
        paymentAlertCodes.paymentMethodMismatch,
        report,
      );
    }
  } else if (payment.status !== "pending") {
    return permanentRejection(
      paymentAlertCodes.paymentMethodMismatch,
      report,
    );
  }
  if (
    donation.providerPaymentId !== null &&
    donation.providerPaymentId !== payment.id
  ) {
    return permanentRejection(
      paymentAlertCodes.providerPaymentIdConflict,
      report,
    );
  }

  const binding = await repository.bindProviderPaymentId(
    donation.id,
    payment.id,
  );
  if (binding.kind === "conflict") {
    return permanentRejection(
      paymentAlertCodes.providerPaymentIdConflict,
      report,
    );
  }

  return applyVerifiedStatus(
    payment,
    binding.donation,
    terminalEvent,
    repository,
    report,
  );
}

export async function reconcilePaymentById(
  { paymentId, terminalEvent }: ReconcilePaymentByIdInput,
  {
    client,
    repository,
    report = defaultPaymentAlertReporter,
  }: ReconcilePaymentByIdDependencies,
): Promise<ReconcileOutcome> {
  let payment: YooKassaPayment;

  try {
    payment = await client.getPayment(paymentId);
  } catch (error) {
    return mapProviderGetError(error, report);
  }

  return reconcileVerifiedPayment(
    { payment, terminalEvent, expectedPaymentId: paymentId },
    { repository, report },
  );
}

function parseCapturedAt(value: string | undefined): Date | null {
  if (!isNonblankString(value)) {
    return null;
  }

  const capturedAt = new Date(value);
  return Number.isNaN(capturedAt.getTime()) ? null : capturedAt;
}

function confirmationUrl(payment: YooKassaPayment): string | null {
  return payment.confirmation?.type === "redirect"
    ? payment.confirmation.url
    : null;
}

async function applyVerifiedStatus(
  payment: YooKassaPayment,
  donation: Donation,
  terminalEvent: SupportedWebhookEvent | null,
  repository: ReconcileRepository,
  report: PaymentAlertReporter,
): Promise<ReconcileOutcome> {
  if (payment.status === "pending") {
    if (terminalEvent !== null) {
      return { kind: "retry", code: reconcileRetryCodes.providerPending };
    }
    return {
      kind: "pending",
      donation,
      confirmationUrl: confirmationUrl(payment),
    };
  }

  if (payment.status === "waiting_for_capture") {
    return { kind: "retry", code: reconcileRetryCodes.captureInvariant };
  }

  if (payment.status === "unknown") {
    return { kind: "retry", code: reconcileRetryCodes.providerProtocol };
  }

  if (payment.status === "succeeded") {
    const capturedAt = parseCapturedAt(payment.capturedAt);
    if (!payment.paid || capturedAt === null) {
      return { kind: "retry", code: reconcileRetryCodes.providerProtocol };
    }
    if (donation.status === "CANCELED") {
      return permanentRejection(
        paymentAlertCodes.terminalStateConflict,
        report,
      );
    }
    if (donation.status === "SUCCEEDED") {
      return { kind: "succeeded", donation };
    }
    return {
      kind: "succeeded",
      donation: await repository.transitionPending(
        donation.id,
        "SUCCEEDED",
        capturedAt,
      ),
    };
  }

  if (payment.status === "canceled") {
    if (donation.status === "SUCCEEDED") {
      return permanentRejection(
        paymentAlertCodes.terminalStateConflict,
        report,
      );
    }
    if (donation.status === "CANCELED") {
      return { kind: "canceled", donation };
    }
    return {
      kind: "canceled",
      donation: await repository.transitionPending(
        donation.id,
        "CANCELED",
        null,
      ),
    };
  }

  return { kind: "retry", code: reconcileRetryCodes.providerProtocol };
}

function mapProviderGetError(
  error: unknown,
  report: PaymentAlertReporter,
): ReconcileOutcome {
  if (error instanceof YooKassaHttpError && error.status === 400) {
    return permanentRejection(
      paymentAlertCodes.invalidProviderSignal,
      report,
    );
  }
  if (error instanceof YooKassaHttpError && error.status === 404) {
    return permanentRejection(
      paymentAlertCodes.providerPaymentMissing,
      report,
    );
  }
  if (
    error instanceof YooKassaHttpError &&
    (error.status === 401 || error.status === 403)
  ) {
    return { kind: "retry", code: reconcileRetryCodes.providerConfiguration };
  }
  if (error instanceof YooKassaProtocolError) {
    return { kind: "retry", code: reconcileRetryCodes.providerProtocol };
  }
  if (
    error instanceof YooKassaUnavailableError ||
    (error instanceof YooKassaHttpError && error.status >= 429)
  ) {
    return { kind: "retry", code: reconcileRetryCodes.providerUnavailable };
  }

  throw error;
}
