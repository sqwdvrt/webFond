import { timingSafeEqual } from "node:crypto";

import { reconcilePendingPayments } from "@/features/payments/reconcile-pending";
import { paymentRepository } from "@/features/payments/repository";
import { readYooKassaConfig } from "@/features/payments/config";
import { createYooKassaClient } from "@/features/payments/yookassa-client";

const headers = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function matchesSecret(value: string | null, expected: string | undefined) {
  if (!value || !expected) return false;
  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function POST(request: Request) {
  if (!matchesSecret(request.headers.get("x-reconcile-secret"), process.env.PAYMENTS_RECONCILE_SECRET)) {
    return new Response(null, { status: 401, headers });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const limit = typeof body.limit === "number" ? body.limit : 25;
    const now = new Date();
    const result = await reconcilePendingPayments({
      repository: paymentRepository,
      client: createYooKassaClient(readYooKassaConfig()),
      now,
      limit,
      maxAge: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1_000),
      maxAttempts: 8,
    });
    return Response.json(result, { headers });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
