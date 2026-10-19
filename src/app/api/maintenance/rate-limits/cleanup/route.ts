import { timingSafeEqual } from "node:crypto";
import { cleanupRateLimitBuckets } from "@/features/maintenance/rate-limit-cleanup";
import { prisma } from "@/lib/db";
import { readLimitedBody } from "@/features/payments/read-limited-body";

const headers = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export async function POST(request: Request) {
  const expected = process.env.MAINTENANCE_SECRET;
  if (!expected || expected.length < 32 || !/^[\x21-\x7e]+$/.test(expected)) {
    return new Response(null, { status: 503, headers });
  }
  const actual = request.headers.get("x-maintenance-secret");
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual ?? "");
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    return new Response(null, { status: 401, headers });
  }

  if (new URL(request.url).search !== "") {
    return new Response(null, { status: 400, headers });
  }
  try {
    // Next.js can provide a stream even for an empty POST. Accept EOF, but reject
    // and cancel as soon as any bytes arrive; never buffer an arbitrary command.
    const body = await readLimitedBody(request, 0);
    if (body.kind === "too-large") return new Response(null, { status: 400, headers });
    return Response.json(await cleanupRateLimitBuckets(prisma), { headers });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
