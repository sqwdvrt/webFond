import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

import { buildDonationWhere } from "./filters";
import type {
  DonationCursor,
  DonationExportFilters,
  DonationPageFilters,
  DonationRow,
} from "./types";

export const DONATION_PAGE_SIZE = 50;
export const DONATION_EXPORT_BATCH_SIZE = 1000;

const donationSelect = {
  id: true,
  providerPaymentId: true,
  amountKopecks: true,
  currency: true,
  status: true,
  donorName: true,
  donorEmail: true,
  paidAt: true,
  createdAt: true,
} satisfies Prisma.DonationSelect;

const donationOrder = [
  { createdAt: "desc" },
  { id: "desc" },
] satisfies Prisma.DonationOrderByWithRelationInput[];

type DonationPageDelegate = {
  count(args: { where: Prisma.DonationWhereInput }): Promise<number>;
  findMany(args: {
    where: Prisma.DonationWhereInput;
    select: typeof donationSelect;
    orderBy: typeof donationOrder;
    skip?: number;
    take: number;
  }): Promise<DonationRow[]>;
};

type DonationExportDelegate = {
  findMany(args: {
    where: Prisma.DonationWhereInput;
    select: typeof donationSelect;
    orderBy: typeof donationOrder;
    take: number;
  }): Promise<DonationRow[]>;
};

type DonationReadClient = { donation: DonationPageDelegate };
type DonationExportClient = { donation: DonationExportDelegate };

type DonationTransactionClient = {
  $transaction(
    callback: (
      client: DonationReadClient,
    ) => Promise<DonationPageResult> | DonationPageResult,
    options: { isolationLevel: "RepeatableRead" },
  ): Promise<DonationPageResult>;
};

export type DonationPageResult = {
  rows: DonationRow[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

export async function getDonationPage(
  filters: DonationPageFilters,
  client: DonationTransactionClient = prisma as unknown as DonationTransactionClient,
): Promise<DonationPageResult> {
  const where = buildDonationWhere(filters);

  return client.$transaction(
    async (transaction) => {
      const total = await transaction.donation.count({ where });
      const totalPages = Math.max(1, Math.ceil(total / DONATION_PAGE_SIZE));
      const page = Math.min(filters.page, totalPages);
      const rows = await transaction.donation.findMany({
        where,
        select: donationSelect,
        orderBy: donationOrder,
        skip: (page - 1) * DONATION_PAGE_SIZE,
        take: DONATION_PAGE_SIZE,
      });

      return {
        rows,
        total,
        totalPages,
        page,
        pageSize: DONATION_PAGE_SIZE,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export async function getDonationExportBatch(
  filters: DonationExportFilters,
  cursor: DonationCursor | null,
  limit = DONATION_EXPORT_BATCH_SIZE,
  client: DonationExportClient = prisma as unknown as DonationExportClient,
) {
  const baseWhere = buildDonationWhere(filters);
  const cursorWhere: Prisma.DonationWhereInput | null = cursor
    ? {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      }
    : null;
  const where = cursorWhere ? { AND: [baseWhere, cursorWhere] } : baseWhere;
  const rows = await client.donation.findMany({
    where,
    select: donationSelect,
    orderBy: donationOrder,
    take: limit,
  });
  const last = rows.at(-1);

  return {
    rows,
    nextCursor:
      rows.length === limit && last
        ? { createdAt: last.createdAt, id: last.id }
        : null,
  };
}
