export const paymentAlertCodes = {
  localDonationMissing: "payment_local_donation_missing",
  paymentIdMismatch: "payment_id_mismatch",
  metadataMismatch: "payment_metadata_mismatch",
  amountMismatch: "payment_amount_mismatch",
  currencyMismatch: "payment_currency_mismatch",
  paymentMethodMismatch: "payment_method_mismatch",
  providerPaymentIdConflict: "payment_provider_id_conflict",
  invalidProviderSignal: "payment_provider_signal_invalid",
  providerPaymentMissing: "payment_provider_payment_missing",
  terminalStateConflict: "payment_terminal_state_conflict",
} as const;

export type PaymentAlertCode =
  (typeof paymentAlertCodes)[keyof typeof paymentAlertCodes];

export type PaymentAlertReporter = (code: PaymentAlertCode) => void;

export const defaultPaymentAlertReporter: PaymentAlertReporter = (code) => {
  console.error(code);
};

export type PaymentReconciliationDiagnostic = {
  paymentId: string;
  donationId?: string;
  providerStatus?: string;
  paymentMethod?: string;
  outcome: "retry" | "permanent-rejection";
  code: string;
};

export type PaymentDiagnosticReporter = (context: PaymentReconciliationDiagnostic) => void;

function logToken(value: string | undefined): string | null {
  if (value === undefined) return null;
  return /^[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : "invalid";
}

export const reportPaymentReconciliationFailure: PaymentDiagnosticReporter = (context) => {
  // Explicit allowlist: never log raw provider payloads, email or credentials.
  console.error("payment_reconciliation_failed", {
    paymentId: logToken(context.paymentId),
    donationId: logToken(context.donationId),
    providerStatus: logToken(context.providerStatus),
    paymentMethod: logToken(context.paymentMethod),
    outcome: context.outcome,
    code: logToken(context.code),
  });
};
