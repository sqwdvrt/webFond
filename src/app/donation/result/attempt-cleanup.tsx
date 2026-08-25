"use client";

import { useEffect } from "react";

import {
  PAYMENT_ATTEMPT_STORAGE_KEY,
  clearPaymentAttempt,
} from "@/features/payments/attempt-storage";

export function AttemptCleanup({ donationId }: { donationId: string }) {
  useEffect(() => {
    const raw = sessionStorage.getItem(PAYMENT_ATTEMPT_STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { donationId?: string };
      if (parsed.donationId === donationId) {
        clearPaymentAttempt({ storage: sessionStorage });
      }
    } catch {
      // Leave an unreadable record for the next explicit user action.
    }
  }, [donationId]);

  return <span data-testid="attempt-cleanup" data-donation-id={donationId} hidden />;
}
