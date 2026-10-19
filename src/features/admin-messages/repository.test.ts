import { describe, expect, it, vi } from "vitest";

import {
  CONTACT_PAGE_SIZE,
  countNewContactRequests,
  getAdminContactRequest,
  getContactRequestPage,
  getContactHistory,
} from "./repository";

it("reads only a bounded history of status and note events without note payloads", async () => {
  const findMany = vi.fn(async () => []);
  await getContactHistory("contact-1", { adminAuditEvent: { findMany } } as never);
  expect(findMany).toHaveBeenCalledWith({
    where: { entityType: "CONTACT_REQUEST", entityId: "contact-1", action: { in: ["CONTACT_STATUS_CHANGED", "CONTACT_NOTE_CHANGED"] } },
    select: { id: true, action: true, previousStatus: true, nextStatus: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20,
  });
});

const listRow = {
  id: "contact-1",
  name: "Анна Иванова",
  email: "anna@example.org",
  message: "Хочу узнать, как помочь фонду.",
  status: "NEW" as const,
  createdAt: new Date("2026-08-23T08:00:00.000Z"),
  updatedAt: new Date("2026-08-23T09:00:00.000Z"),
};

function pageClient(total: number, rows = [listRow]) {
  const count = vi.fn(async (...args: unknown[]) => {
    void args;
    return total;
  });
  const findMany = vi.fn(async (...args: unknown[]) => {
    void args;
    return rows;
  });
  const transaction = vi.fn(
    async (callback: (tx: {
      contactRequest: { count: typeof count; findMany: typeof findMany };
    }) => Promise<unknown>) => callback({ contactRequest: { count, findMany } }),
  );
  const client = { $transaction: transaction } as unknown as NonNullable<
    Parameters<typeof getContactRequestPage>[1]
  >;

  return { client, count, findMany, transaction };
}

describe("contact request repository page", () => {
  it("counts then reads a stable page in one repeatable-read transaction", async () => {
    const mocks = pageClient(26);

    const result = await getContactRequestPage(
      { status: "NEW", page: 2 },
      mocks.client,
    );

    expect(result).toEqual({
      rows: [listRow],
      total: 26,
      totalPages: 2,
      page: 2,
      pageSize: 25,
    });
    expect(CONTACT_PAGE_SIZE).toBe(25);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "RepeatableRead",
    });
    expect(mocks.count).toHaveBeenCalledWith({ where: { status: "NEW" } });
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { status: "NEW" },
      select: {
        id: true,
        name: true,
        email: true,
        message: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: 25,
      take: 25,
    });
    expect(mocks.count.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.findMany.mock.invocationCallOrder[0],
    );
  });

  it("clamps an excessive page before calculating its offset", async () => {
    const mocks = pageClient(26);

    const result = await getContactRequestPage({ page: 999999 }, mocks.client);

    expect(result).toMatchObject({ page: 2, totalPages: 2 });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 25 }),
    );
  });

  it("uses page one for an empty result", async () => {
    const mocks = pageClient(0, []);

    const result = await getContactRequestPage({ page: 999999 }, mocks.client);

    expect(result).toMatchObject({
      rows: [],
      total: 0,
      page: 1,
      totalPages: 1,
    });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 }),
    );
  });
});

describe("contact request repository summaries", () => {
  it("counts only new contact requests", async () => {
    const count = vi.fn(async (...args: unknown[]) => {
      void args;
      return 3;
    });

    const result = await countNewContactRequests({ contactRequest: { count } });

    expect(result).toBe(3);
    expect(count).toHaveBeenCalledOnce();
    expect(count).toHaveBeenCalledWith({ where: { status: "NEW" } });
  });

  it("loads one contact request with the detail fields", async () => {
    const detail = { ...listRow, internalNote: "Перезвонить утром" };
    const findUnique = vi.fn(async (...args: unknown[]) => {
      void args;
      return detail;
    });

    const result = await getAdminContactRequest("contact-1", {
      contactRequest: { findUnique },
    });

    expect(result).toEqual(detail);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "contact-1" },
      select: {
        id: true,
        name: true,
        email: true,
        message: true,
        status: true,
        internalNote: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });
});
