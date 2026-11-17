import { timingSafeEqual } from "node:crypto";
import { readPaymentsAvailability } from "@/features/payments/config";
import { checkDependencies, type StatusDatabase } from "@/features/readiness/dependencies";
import { privateJsonResponse } from "@/lib/http/private-json-response";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
let nextCheckAt = 0;

export async function GET(request: Request) {
  const expected = process.env.MAINTENANCE_SECRET;
  if (!expected || expected.length < 32 || !/^[\x21-\x7e]+$/.test(expected)) return privateJsonResponse({ ok: false }, 503);
  const actual = request.headers.get("x-maintenance-secret") ?? "";
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  if (expectedBytes.length !== actualBytes.length || !timingSafeEqual(expectedBytes, actualBytes)) return privateJsonResponse({ ok: false }, 401);
  if (new URL(request.url).search) return privateJsonResponse({ ok: false }, 400);
  const now = Date.now();
  if (now < nextCheckAt) {
    const response = privateJsonResponse({ ok: false }, 429);
    response.headers.set("Retry-After", String(Math.ceil((nextCheckAt - now) / 1000)));
    return response;
  }
  // Authenticated probes only; this per-process bound protects the DB, not callers.
  nextCheckAt = now + 5000;
  try {
    const status = await checkDependencies(prisma as unknown as StatusDatabase, readPaymentsAvailability().enabled, new Date(now));
    return privateJsonResponse(status, status.ok ? 200 : 503);
  } catch {
    return privateJsonResponse({ ok: false }, 503);
  }
}
