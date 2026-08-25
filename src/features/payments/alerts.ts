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
