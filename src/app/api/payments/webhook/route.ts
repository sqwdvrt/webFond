import { reconcilePaymentById, type ReconcileOutcome } from "@/features/payments/reconcile";
import { readLimitedBody } from "@/features/payments/read-limited-body";
import { paymentRepository } from "@/features/payments/repository";
import { parseWebhookEnvelope } from "@/features/payments/validation";
import { createYooKassaClient } from "@/features/payments/yookassa-client";
import { defaultPaymentAlertReporter, type PaymentAlertReporter } from "@/features/payments/alerts";
import { readYooKassaConfig } from "@/features/payments/config";

const BODY_LIMIT = 65_536;
const PRIVACY_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

type WebhookReconcile = (
  input: Parameters<typeof reconcilePaymentById>[0],
  extras: { report: PaymentAlertReporter },
) => Promise<ReconcileOutcome>;

type WebhookRouteDependencies = {
  reconcile: WebhookReconcile;
  report: PaymentAlertReporter;
};

const defaultDependencies: WebhookRouteDependencies = {
  reconcile: (input, extras) =>
    reconcilePaymentById(input, {
      client: createYooKassaClient(readYooKassaConfig()),
      repository: paymentRepository,
      ...extras,
    }),
  report: defaultPaymentAlertReporter,
};

function emptyResponse(status: number) {
  return new Response(null, { status, headers: PRIVACY_HEADERS });
}

function mapOutcome(outcome: ReconcileOutcome): Response {
  switch (outcome.kind) {
    case "succeeded":
    case "canceled":
    case "permanent-rejection":
      return emptyResponse(200);
    case "pending":
    case "retry":
      return emptyResponse(503);
  }
}

export async function handlePaymentWebhook(
  request: Request,
  dependencies: WebhookRouteDependencies = defaultDependencies,
): Promise<Response> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength !== null && Number(contentLength) > BODY_LIMIT) {
    return emptyResponse(413);
  }

  try {
    const body = await readLimitedBody(request, BODY_LIMIT);
    if (body.kind === "too-large") {
      return emptyResponse(413);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(body.bytes));
    } catch {
      return emptyResponse(400);
    }

    const envelope = parseWebhookEnvelope(parsed);
    if (envelope.kind === "malformed") {
      return emptyResponse(400);
    }
    if (
      envelope.kind === "unsupported-type" ||
      envelope.kind === "unsupported-event"
    ) {
      return emptyResponse(200);
    }

    const outcome = await dependencies.reconcile(
      { paymentId: envelope.paymentId, terminalEvent: envelope.event },
      { report: dependencies.report },
    );
    return mapOutcome(outcome);
  } catch {
    return emptyResponse(503);
  }
}

export async function POST(request: Request) {
  return handlePaymentWebhook(request);
}
