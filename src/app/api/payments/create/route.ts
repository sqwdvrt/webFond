import { PaymentsConfigurationError, readPaymentCreateConfig } from "@/features/payments/config";
import { createPaymentClientKey } from "@/features/payments/client-key";
import {
  createPayment as orchestratePayment,
  type CreatePaymentCommand,
  type CreatePaymentDependencies,
  type CreatePaymentOutcome,
} from "@/features/payments/create-payment";
import { readLimitedBody } from "@/features/payments/read-limited-body";
import { paymentRepository } from "@/features/payments/repository";
import type { PaymentCreateConfig } from "@/features/payments/types";
import { parsePaymentCreateInput } from "@/features/payments/validation";
import { createYooKassaClient } from "@/features/payments/yookassa-client";

const BODY_LIMIT = 8192;
const PRIVACY_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

type CreatePaymentRouteDependencies = {
  readConfig: () => PaymentCreateConfig;
  createClientKey: typeof createPaymentClientKey;
  createPayment: (
    command: CreatePaymentCommand,
    dependencies: Omit<CreatePaymentDependencies, "client" | "repository"> &
      Partial<Pick<CreatePaymentDependencies, "client" | "repository">>,
  ) => Promise<CreatePaymentOutcome>;
  now: () => Date;
  environment: string | undefined;
  reportConfigError: (code: PaymentsConfigurationError["code"]) => void;
};

const defaultDependencies: CreatePaymentRouteDependencies = {
  readConfig: () => readPaymentCreateConfig(),
  createClientKey: createPaymentClientKey,
  createPayment: (command, dependencies) =>
    orchestratePayment(command, {
      client: createYooKassaClient(dependencies.config),
      repository: paymentRepository,
      ...dependencies,
    }),
  now: () => new Date(),
  environment: process.env.NODE_ENV,
  reportConfigError: (code) => {
    console.error("payment_create_config", code);
  },
};

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  extraHeaders: HeadersInit = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...PRIVACY_HEADERS,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function emptyResponse(status: number) {
  return new Response(null, { status, headers: PRIVACY_HEADERS });
}

function isJsonContentType(value: string | null): boolean {
  return value?.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

function sameOrigin(
  request: Request,
  siteUrl: string | undefined = process.env.SITE_URL,
): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) {
    return false;
  }

  try {
    const requestOrigin = new URL(origin).origin;
    if (requestOrigin === new URL(request.url).origin) {
      return true;
    }
    if (!siteUrl) {
      return false;
    }
    return requestOrigin === new URL(siteUrl).origin;
  } catch {
    return false;
  }
}

function mapOutcome(outcome: CreatePaymentOutcome): Response {
  switch (outcome.kind) {
    case "redirect":
    case "result":
      return jsonResponse(200, {
        redirectUrl: outcome.url,
        donationId: outcome.donationId,
      });
    case "rate-limited":
      return jsonResponse(
        429,
        { error: "rate_limited" },
        { "Retry-After": String(outcome.retryAfterSeconds) },
      );
    case "stale-attempt":
      return jsonResponse(409, { error: "stale_attempt" });
    case "conflict":
      return jsonResponse(409, { error: "conflict" });
    case "provider-rejected":
      return jsonResponse(502, { error: "provider_rejected" });
    case "configuration-unavailable":
      return jsonResponse(503, { error: "configuration_unavailable" });
    case "provider-endpoint-error":
      return jsonResponse(502, { error: "provider_endpoint_error" });
    case "provider-unavailable":
      return jsonResponse(503, { error: "provider_unavailable" });
    case "protocol-error":
      return jsonResponse(502, { error: "provider_protocol" });
  }
}

export async function handlePaymentCreate(
  request: Request,
  dependencies: CreatePaymentRouteDependencies = defaultDependencies,
): Promise<Response> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength !== null && Number(contentLength) > BODY_LIMIT) {
    return emptyResponse(413);
  }

  if (!isJsonContentType(request.headers.get("Content-Type"))) {
    return emptyResponse(415);
  }

  if (!sameOrigin(request)) {
    return emptyResponse(403);
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
      return jsonResponse(400, { error: "invalid_request" });
    }

    const input = parsePaymentCreateInput(parsed);
    if (input.kind === "bot") {
      return emptyResponse(204);
    }
    if (input.kind === "invalid") {
      return jsonResponse(400, { error: "invalid_request" });
    }

    const config = dependencies.readConfig();
    const clientKey = dependencies.createClientKey({
      headers: request.headers,
      secret: config.rateLimitSecret,
      trustProxy: config.trustProxy,
      environment: dependencies.environment,
    });
    const outcome = await dependencies.createPayment(
      {
        amountKopecks: input.amountKopecks,
        attemptId: input.input.attemptId,
        customerEmail: input.input.email,
        clientKey,
      },
      { config, now: dependencies.now() },
    );
    return mapOutcome(outcome);
  } catch (error) {
    if (error instanceof PaymentsConfigurationError) {
      dependencies.reportConfigError(error.code);
      return jsonResponse(503, { error: "configuration_unavailable" });
    }
    return jsonResponse(500, { error: "internal_error" });
  }
}

export async function POST(request: Request) {
  return handlePaymentCreate(request);
}
