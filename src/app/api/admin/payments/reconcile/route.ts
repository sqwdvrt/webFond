import { reconcilePendingPayments } from "@/features/payments/reconcile-pending";
import { paymentRepository } from "@/features/payments/repository";
import { readYooKassaConfig } from "@/features/payments/config";
import { createYooKassaClient } from "@/features/payments/yookassa-client";
import { requireAdminSession } from "@/lib/admin-auth/session";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export async function POST(request: Request) {
  await requireAdminSession();
  const body = await request.json().catch(() => ({}));
  const limit = typeof body.limit === "number" ? body.limit : 25;
  const now = new Date();

  try {
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
