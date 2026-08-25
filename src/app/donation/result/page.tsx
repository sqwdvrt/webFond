import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Donation } from "@prisma/client";

import {
  reconcilePaymentById,
  type ReconcileOutcome,
} from "@/features/payments/reconcile";
import { paymentRepository } from "@/features/payments/repository";
import { createYooKassaClient } from "@/features/payments/yookassa-client";
import { readYooKassaConfig } from "@/features/payments/config";

import { AttemptCleanup } from "./attempt-cleanup";
import { ResultView, type DonationResultView } from "./result-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Результат пожертвования",
  robots: { index: false, follow: false },
};

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ResultSearchParams = Promise<{ donation?: string | string[] }>;

type ResultPageDependencies = {
  findById: (id: string) => Promise<Donation | null>;
  reconcile: (input: {
    paymentId: string;
    terminalEvent: null;
  }) => Promise<ReconcileOutcome>;
};

const defaultDependencies: ResultPageDependencies = {
  findById: (id) => paymentRepository.findById(id),
  reconcile: (input) =>
    reconcilePaymentById(input, {
      client: createYooKassaClient(readYooKassaConfig()),
      repository: paymentRepository,
    }),
};

function viewForOutcome(outcome: ReconcileOutcome): DonationResultView {
  switch (outcome.kind) {
    case "succeeded":
      return { kind: "succeeded" };
    case "canceled":
      return { kind: "canceled" };
    case "pending":
      return { kind: "pending" };
    case "retry":
    case "permanent-rejection":
      return { kind: "technical-error" };
  }
}

export async function renderDonationResultPage(
  searchParams: ResultSearchParams,
  dependencies: ResultPageDependencies = defaultDependencies,
) {
  const params = await searchParams;
  const donationId =
    typeof params.donation === "string" ? params.donation : undefined;

  if (!donationId || !UUID_V4.test(donationId)) {
    notFound();
  }

  const donation = await dependencies.findById(donationId);
  if (!donation) {
    notFound();
  }

  let view: DonationResultView = { kind: "pending" };
  if (donation.providerPaymentId) {
    const outcome = await dependencies.reconcile({
      paymentId: donation.providerPaymentId,
      terminalEvent: null,
    });
    view = viewForOutcome(outcome);
  }

  return (
    <>
      <ResultView {...view} />
      {view.kind === "succeeded" || view.kind === "canceled" ? (
        <AttemptCleanup donationId={donation.id} />
      ) : null}
    </>
  );
}

export default async function DonationResultPage({
  searchParams,
}: {
  searchParams: ResultSearchParams;
}) {
  return renderDonationResultPage(searchParams);
}
