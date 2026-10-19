import { describe, expect, it, vi } from "vitest";

import { reportPaymentReconciliationFailure } from "./alerts";

describe("payment reconciliation diagnostics", () => {
  it("logs only bounded identifiers and diagnostic fields, never raw provider data", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const context = {
        paymentId: "provider-1", donationId: "donation-1",
        providerStatus: "succeeded", paymentMethod: "sberbank",
        outcome: "permanent-rejection" as const, code: "payment_amount_mismatch",
        donorEmail: "private@example.org", raw: { secret: "private" },
      };
      reportPaymentReconciliationFailure(context);
      expect(error).toHaveBeenCalledExactlyOnceWith("payment_reconciliation_failed", {
        paymentId: "provider-1", donationId: "donation-1",
        providerStatus: "succeeded", paymentMethod: "sberbank",
        outcome: "permanent-rejection", code: "payment_amount_mismatch",
      });
    } finally { error.mockRestore(); }
  });

  it("redacts malformed or oversized data and explicitly records an absent method", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      reportPaymentReconciliationFailure({
        paymentId: "private@example.org\nforged", donationId: "x".repeat(129),
        outcome: "retry", code: "payment_provider_protocol",
      });
      expect(error).toHaveBeenCalledWith("payment_reconciliation_failed", {
        paymentId: "invalid", donationId: "invalid", providerStatus: null,
        paymentMethod: null, outcome: "retry", code: "payment_provider_protocol",
      });
    } finally { error.mockRestore(); }
  });
});
