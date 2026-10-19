import { reconcilePendingPayments, reconcileSinglePayment } from "@/features/payments/reconcile-pending";
import { parseReconcileRequest } from "@/features/payments/reconcile-request";
import { readLimitedBody } from "@/features/payments/read-limited-body";
import { paymentRepository, consumeReconciliationQuota } from "@/features/payments/repository";
import { PaymentRateLimitedError } from "@/features/payments/rate-limit";
import { readYooKassaConfig } from "@/features/payments/config";
import { createYooKassaClient } from "@/features/payments/yookassa-client";
import { getAdminSession } from "@/lib/admin-auth/session";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export async function POST(request: Request) {
  if (!await getAdminSession()) return Response.json({ error: "unauthorized" }, { status: 401, headers });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(process.env.SITE_URL ?? request.url).origin) return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  const body = await readLimitedBody(request, 4096);
  if (body.kind === "too-large") return Response.json({ error: "body_too_large" }, { status: 413, headers });
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(body.bytes)); } catch { return Response.json({ error: "invalid_request" }, { status: 400, headers }); }
  const command = parseReconcileRequest(parsed);
  if (!command) return Response.json({ error: "invalid_request" }, { status: 400, headers });
  const now = new Date();

  try {
    await consumeReconciliationQuota(now, command.mode === "batch");
    const dependencies = {
      repository: paymentRepository,
      client: createYooKassaClient(readYooKassaConfig()),
      now,
    };
    if (command.mode === "single") {
      const result = await reconcileSinglePayment({ ...dependencies, donationId: command.donationId });
      const status = result.kind === "not-found" ? 404 : result.kind === "busy" ? 409 : result.kind === "unbound" ? 422 : 200;
      return Response.json(result, { status, headers });
    }
    const result = await reconcilePendingPayments({ ...dependencies, limit: command.limit });
    return Response.json(result, { headers });
  } catch (error) {
    if (error instanceof PaymentRateLimitedError) return Response.json({ error: "rate_limited" }, { status: 429, headers: { ...headers, "Retry-After": String(error.retryAfterSeconds) } });
    return new Response(null, { status: 503, headers });
  }
}
