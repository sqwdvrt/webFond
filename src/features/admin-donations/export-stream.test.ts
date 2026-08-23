import { describe, expect, it, vi } from "vitest";

import type { DonationRow } from "./types";
import { createDonationCsvStream } from "./export-stream";

function row(id: string): DonationRow {
  return {
    id,
    providerPaymentId: null,
    amountKopecks: 100,
    currency: "RUB",
    status: "PENDING",
    donorName: null,
    donorEmail: null,
    paidAt: null,
    createdAt: new Date("2026-08-23T09:00:00.000Z"),
  };
}

async function readStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { ignoreBOM: true });
  let result = "";

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) return result;
    result += decoder.decode(chunk.value, { stream: true });
  }
}

describe("donation CSV stream", () => {
  it("fails before creating a stream when the first batch fails", async () => {
    const failure = new Error("database details");
    const fetchBatch = vi.fn(async () => {
      throw failure;
    });

    await expect(
      createDonationCsvStream({ filters: {}, fetchBatch, report: vi.fn() }),
    ).rejects.toBe(failure);
  });

  it("returns a header-only stream for an empty selection", async () => {
    const stream = await createDonationCsvStream({
      filters: {},
      fetchBatch: vi.fn(async () => ({ rows: [], nextCursor: null })),
      report: vi.fn(),
    });

    const output = await readStream(stream);
    expect(output).toContain("\uFEFF\"ID\";\"Дата создания\"");
    expect(output.split("\r\n")).toHaveLength(2);
  });

  it("streams 1001 rows in two demand-driven batches", async () => {
    const firstRows = Array.from({ length: 1000 }, (_, index) =>
      row(`donation-${index + 1}`),
    );
    const fetchBatch = vi
      .fn()
      .mockResolvedValueOnce({
        rows: firstRows,
        nextCursor: { createdAt: firstRows[999].createdAt, id: "donation-1000" },
      })
      .mockResolvedValueOnce({ rows: [row("donation-1001")], nextCursor: null });

    const stream = await createDonationCsvStream({
      filters: {},
      fetchBatch,
      report: vi.fn(),
    });
    expect(fetchBatch).toHaveBeenCalledOnce();

    const output = await readStream(stream);
    expect(fetchBatch).toHaveBeenCalledTimes(2);
    expect(output).toContain('"donation-1"');
    expect(output).toContain('"donation-1001"');
  });

  it("does not fetch another batch after cancellation", async () => {
    const first = row("donation-1");
    const fetchBatch = vi.fn(async () => ({
      rows: [first],
      nextCursor: { createdAt: first.createdAt, id: first.id },
    }));
    const stream = await createDonationCsvStream({
      filters: {},
      fetchBatch,
      report: vi.fn(),
    });

    await stream.cancel();
    await Promise.resolve();
    expect(fetchBatch).toHaveBeenCalledOnce();
  });

  it("reports only a static event and exposes a neutral late error", async () => {
    const rawFailure = new Error("Prisma PII fixture@example.test");
    const first = row("donation-1");
    const fetchBatch = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [first],
        nextCursor: { createdAt: first.createdAt, id: first.id },
      })
      .mockRejectedValueOnce(rawFailure);
    const report = vi.fn();
    const stream = await createDonationCsvStream({
      filters: { q: "fixture@example.test" },
      fetchBatch,
      report,
    });
    const reader = stream.getReader();

    expect((await reader.read()).done).toBe(false);
    await expect(reader.read()).rejects.toThrow("Donation CSV stream failed");
    expect(report).toHaveBeenCalledWith("donation_csv_stream_failed");
    expect(report).not.toHaveBeenCalledWith(rawFailure);
    expect(report).not.toHaveBeenCalledWith(
      expect.stringContaining("fixture@example.test"),
    );
  });
});
