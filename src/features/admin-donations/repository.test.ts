import { describe, expect, it, vi } from "vitest";

import type { DonationPageFilters, DonationRow } from "./types";
import { getDonationExportBatch, getDonationPage } from "./repository";

const row: DonationRow = {
  id: "donation-1",
  providerPaymentId: "payment-1",
  amountKopecks: 12500,
  currency: "RUB",
  status: "SUCCEEDED",
  donorName: "Тестовый плательщик",
  donorEmail: "fixture@example.test",
  paidAt: new Date("2026-08-23T09:00:00.000Z"),
  createdAt: new Date("2026-08-23T08:00:00.000Z"),
};

function pageClient(total: number, rows: DonationRow[] = [row]) {
  const count = vi.fn(async (...args: unknown[]) => {
    void args;
    return total;
  });
  const findMany = vi.fn(async (...args: unknown[]) => {
    void args;
    return rows;
  });
  const transaction = vi.fn(
    async (callback: (tx: { donation: { count: typeof count; findMany: typeof findMany } }) => Promise<unknown>) =>
      callback({ donation: { count, findMany } }),
  );

  const client = { $transaction: transaction } as unknown as NonNullable<
    Parameters<typeof getDonationPage>[1]
  >;

  return { client, count, findMany, transaction };
}

describe("donation repository page", () => {
  it("reads a stable page inside a repeatable-read transaction", async () => {
    const mocks = pageClient(51);
    const filters: DonationPageFilters = { status: "SUCCEEDED", page: 2 };

    const result = await getDonationPage(filters, mocks.client);

    expect(result).toEqual({
      rows: [row],
      total: 51,
      totalPages: 2,
      page: 2,
      pageSize: 50,
    });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "RepeatableRead",
    });
    expect(mocks.count).toHaveBeenCalledWith({ where: { status: "SUCCEEDED" } });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "SUCCEEDED" },
        skip: 50,
        take: 50,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
  });

  it("clamps excessive and empty-result pages before calculating skip", async () => {
    const excessive = pageClient(51);
    const empty = pageClient(0, []);

    expect(await getDonationPage({ page: 999999 }, excessive.client)).toMatchObject({
      page: 2,
      totalPages: 2,
    });
    expect(excessive.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 50 }),
    );

    expect(await getDonationPage({ page: 999999 }, empty.client)).toMatchObject({
      page: 1,
      totalPages: 1,
      rows: [],
    });
    expect(empty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 }),
    );
  });
});

describe("donation repository export batches", () => {
  it("uses base filters and the stable order for the first batch", async () => {
    const findMany = vi.fn(async (...args: unknown[]) => {
      void args;
      return [row];
    });

    await getDonationExportBatch(
      { status: "SUCCEEDED" },
      null,
      undefined,
      { donation: { findMany } },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "SUCCEEDED" },
        take: 1000,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
    expect(findMany.mock.calls[0][0]).not.toHaveProperty("cursor");
  });

  it("keeps search OR conditions when applying a manual keyset", async () => {
    const findMany = vi.fn(async (...args: unknown[]) => {
      void args;
      return [] as DonationRow[];
    });
    const cursor = {
      createdAt: new Date("2026-08-23T08:00:00.000Z"),
      id: "donation-500",
    };

    await getDonationExportBatch(
      { q: "fixture" },
      cursor,
      1000,
      { donation: { findMany } },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              OR: [
                {
                  donorName: { contains: "fixture", mode: "insensitive" },
                },
                {
                  donorEmail: { contains: "fixture", mode: "insensitive" },
                },
                {
                  providerPaymentId: {
                    contains: "fixture",
                    mode: "insensitive",
                  },
                },
              ],
            },
            {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            },
          ],
        },
        take: 1000,
      }),
    );
    expect(findMany.mock.calls[0][0]).not.toHaveProperty("cursor");
  });

  it("does not omit or duplicate equal timestamps across a batch boundary", async () => {
    const createdAt = new Date("2026-08-23T08:00:00.000Z");
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      ...row,
      id: `donation-${String(1001 - index).padStart(4, "0")}`,
      createdAt,
    }));
    const findMany = vi.fn(async (args: { where: unknown; take: number }) => {
      const serialized = JSON.stringify(args.where);
      const cursorMatch = serialized.match(/"lt":"(donation-\d+)"/);
      const start = cursorMatch
        ? rows.findIndex((candidate) => candidate.id === cursorMatch[1]) + 1
        : 0;
      return rows.slice(start, start + args.take);
    });
    const client = { donation: { findMany } };

    const first = await getDonationExportBatch({}, null, 1000, client);
    const second = await getDonationExportBatch(
      {},
      first.nextCursor,
      1000,
      client,
    );
    const ids = [...first.rows, ...second.rows].map((item) => item.id);

    expect(ids).toHaveLength(1001);
    expect(new Set(ids)).toHaveLength(1001);
  });
});
