import { timingSafeEqual } from "node:crypto";
import { parseReconcileRequest } from "@/features/payments/reconcile-request";
import { readLimitedBody } from "@/features/payments/read-limited-body";
import { prisma } from "@/lib/db";

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
    const body = await readLimitedBody(request, 4096);
    if (body.kind === "too-large") return new Response(null, { status: 413, headers });
    let raw: unknown;
    try { raw = JSON.parse(new TextDecoder().decode(body.bytes) || "{}"); } catch { return new Response(null, { status: 400, headers }); }
    const command = parseReconcileRequest(raw);
    if (!command || command.mode !== "batch") return new Response(null, { status: 400, headers });
    const now = new Date();
    const result = await reconcilePendingPayments({
      repository: paymentRepository,
      client: createYooKassaClient(readYooKassaConfig()),
      now,
      limit: command.limit,
    });
    await prisma.siteSetting.upsert({ where: { key: "paymentsReconciliationHeartbeat" }, create: { key: "paymentsReconciliationHeartbeat", value: { completedAt: new Date().toISOString(), failed: result.failed } }, update: { value: { completedAt: new Date().toISOString(), failed: result.failed } } });
    return Response.json(result, { headers });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
