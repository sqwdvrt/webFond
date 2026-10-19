import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

import { buildContactWhere } from "./filters";
import type { ContactPageFilters } from "./types";

export const CONTACT_PAGE_SIZE = 25;

const historySelect = { id: true, action: true, previousStatus: true, nextStatus: true, createdAt: true } satisfies Prisma.AdminAuditEventSelect;
export type ContactHistoryEvent = Prisma.AdminAuditEventGetPayload<{ select: typeof historySelect }>;

export function getContactHistory(
  id: string,
  client: { adminAuditEvent: { findMany(args: Prisma.AdminAuditEventFindManyArgs): Promise<ContactHistoryEvent[]> } } = prisma,
) {
  return client.adminAuditEvent.findMany({
    where: { entityType: "CONTACT_REQUEST", entityId: id, action: { in: ["CONTACT_STATUS_CHANGED", "CONTACT_NOTE_CHANGED"] } },
    select: historySelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 20,
  });
}

const contactListSelect = {
  id: true,
  name: true,
  email: true,
  message: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ContactRequestSelect;

const contactDetailSelect = {
  ...contactListSelect,
  internalNote: true,
} satisfies Prisma.ContactRequestSelect;

const contactOrder = [
  { createdAt: "desc" },
  { id: "desc" },
] satisfies Prisma.ContactRequestOrderByWithRelationInput[];

type ContactListRow = Prisma.ContactRequestGetPayload<{
  select: typeof contactListSelect;
}>;

type ContactDetail = Prisma.ContactRequestGetPayload<{
  select: typeof contactDetailSelect;
}>;

type ContactPageDelegate = {
  count(args: { where: Prisma.ContactRequestWhereInput }): Promise<number>;
  findMany(args: {
    where: Prisma.ContactRequestWhereInput;
    select: typeof contactListSelect;
    orderBy: typeof contactOrder;
    skip: number;
    take: number;
  }): Promise<ContactListRow[]>;
};

type ContactDetailDelegate = {
  findUnique(args: {
    where: { id: string };
    select: typeof contactDetailSelect;
  }): Promise<ContactDetail | null>;
};

type ContactCountDelegate = {
  count(args: { where: { status: "NEW" } }): Promise<number>;
};

type ContactPageReadClient = { contactRequest: ContactPageDelegate };
type ContactDetailClient = { contactRequest: ContactDetailDelegate };
type ContactCountClient = { contactRequest: ContactCountDelegate };

type ContactTransactionClient = {
  $transaction(
    callback: (
      client: ContactPageReadClient,
    ) => Promise<ContactPageResult> | ContactPageResult,
    options: { isolationLevel: "RepeatableRead" },
  ): Promise<ContactPageResult>;
};

export type ContactPageResult = {
  rows: ContactListRow[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

export async function getContactRequestPage(
  filters: ContactPageFilters,
  client: ContactTransactionClient = prisma as unknown as ContactTransactionClient,
): Promise<ContactPageResult> {
  const where = buildContactWhere(filters);

  return client.$transaction(
    async (transaction) => {
      const total = await transaction.contactRequest.count({ where });
      const totalPages = Math.max(1, Math.ceil(total / CONTACT_PAGE_SIZE));
      const page = Math.min(filters.page, totalPages);
      const rows = await transaction.contactRequest.findMany({
        where,
        select: contactListSelect,
        orderBy: contactOrder,
        skip: (page - 1) * CONTACT_PAGE_SIZE,
        take: CONTACT_PAGE_SIZE,
      });

      return {
        rows,
        total,
        totalPages,
        page,
        pageSize: CONTACT_PAGE_SIZE,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export async function getAdminContactRequest(
  id: string,
  client: ContactDetailClient = prisma,
) {
  return client.contactRequest.findUnique({
    where: { id },
    select: contactDetailSelect,
  });
}

export async function countNewContactRequests(
  client: ContactCountClient = prisma,
) {
  return client.contactRequest.count({ where: { status: "NEW" } });
}
