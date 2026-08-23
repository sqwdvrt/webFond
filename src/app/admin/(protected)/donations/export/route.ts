import { createDonationCsvStream } from "@/features/admin-donations/export-stream";
import { parseDonationExportFilters } from "@/features/admin-donations/filters";
import { moscowDateStamp } from "@/features/admin-donations/format";
import { getDonationExportBatch } from "@/features/admin-donations/repository";
import type {
  DonationExportFilters,
  ParseResult,
  SearchParamsInput,
} from "@/features/admin-donations/types";
import { requireAdminSession } from "@/lib/admin-auth/session";

type DonationExportDependencies = {
  requireSession: () => Promise<unknown>;
  parseFilters: (
    input: SearchParamsInput,
  ) => ParseResult<DonationExportFilters>;
  createStream: (
    filters: DonationExportFilters,
  ) => Promise<ReadableStream<Uint8Array>>;
  now: () => Date;
};

const privacyHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

const defaultDependencies: DonationExportDependencies = {
  requireSession: requireAdminSession,
  parseFilters: parseDonationExportFilters,
  createStream: (filters) =>
    createDonationCsvStream({
      filters,
      fetchBatch: getDonationExportBatch,
      report: (event) => console.error(event),
    }),
  now: () => new Date(),
};

export async function handleDonationExport(
  request: Request,
  dependencies: DonationExportDependencies = defaultDependencies,
) {
  await dependencies.requireSession();
  const parsed = dependencies.parseFilters(new URL(request.url).searchParams);

  if (!parsed.ok) {
    return new Response("Некорректные фильтры", {
      status: 400,
      headers: privacyHeaders,
    });
  }

  try {
    const stream = await dependencies.createStream(parsed.value);
    const date = moscowDateStamp(dependencies.now());

    return new Response(stream, {
      headers: {
        ...privacyHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="donations-${date}.csv"`,
      },
    });
  } catch {
    return new Response("Не удалось сформировать CSV", {
      status: 500,
      headers: privacyHeaders,
    });
  }
}

export async function GET(request: Request) {
  return handleDonationExport(request);
}
