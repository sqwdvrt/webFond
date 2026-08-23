import { encodeDonationCsvHeader, encodeDonationCsvRows } from "./csv";
import type {
  DonationCursor,
  DonationExportFilters,
  DonationRow,
} from "./types";

export type DonationBatchFetcher = (
  filters: DonationExportFilters,
  cursor: DonationCursor | null,
) => Promise<{ rows: DonationRow[]; nextCursor: DonationCursor | null }>;

type DonationExportEvent = "donation_csv_stream_failed";

export async function createDonationCsvStream(input: {
  filters: DonationExportFilters;
  fetchBatch: DonationBatchFetcher;
  report: (event: DonationExportEvent) => void;
}) {
  const encoder = new TextEncoder();
  const firstBatch = await input.fetchBatch(input.filters, null);
  let cursor = firstBatch.nextCursor;
  let canceled = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `${encodeDonationCsvHeader()}${encodeDonationCsvRows(firstBatch.rows)}`,
        ),
      );
      if (!cursor) controller.close();
    },
    async pull(controller) {
      if (canceled || !cursor) return;

      try {
        const batch = await input.fetchBatch(input.filters, cursor);
        if (canceled) return;
        const rows = encodeDonationCsvRows(batch.rows);
        if (rows) controller.enqueue(encoder.encode(rows));
        cursor = batch.nextCursor;
        if (!cursor) controller.close();
      } catch {
        input.report("donation_csv_stream_failed");
        controller.error(new Error("Donation CSV stream failed"));
      }
    },
    cancel() {
      canceled = true;
      cursor = null;
    },
  });
}
