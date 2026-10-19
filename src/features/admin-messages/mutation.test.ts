import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  parseContactMutation,
  updateContactRequest,
  updateContactRequestMutation,
  type ContactMutationInput,
  type UpdateContactResult,
} from "./mutation";

const now = new Date("2026-10-16T12:00:00.000Z");
const updatedAt = new Date("2026-10-16T10:00:00.000Z");

function form(
  fields: Record<string, string | string[]> = {
    status: "IN_PROGRESS",
    note: " Позвонить утром ",
    updatedAt: updatedAt.toISOString(),
  },
) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      data.append(key, entry);
    }
  }
  return data;
}

describe("parseContactMutation", () => {
  it("marks a quick status change as preserving the existing note", () => {
    expect(parseContactMutation(form({ status: "CLOSED", intent: "status-only" }))).toEqual({ ok: true, value: { status: "CLOSED", note: null, preserveNote: true } });
  });
  it.each(["NEW", "IN_PROGRESS", "CLOSED", "SPAM"] as const)(
    "accepts the %s status",
    (status) => {
      expect(parseContactMutation(form({ status, note: "" }))).toEqual({
        ok: true,
        value: { status, note: null },
      });
    },
  );

  it("trims a private note", () => {
    expect(parseContactMutation(form({
      status: "NEW",
      note: "  Перезвонить утром  ",
    }))).toEqual({
      ok: true,
      value: { status: "NEW", note: "Перезвонить утром" },
    });
  });

  it("normalizes a whitespace-only note to null", () => {
    expect(parseContactMutation(form({ status: "NEW", note: " \n\t " }))).toEqual({
      ok: true,
      value: { status: "NEW", note: null },
    });
  });

  it("allows a missing note as an intentional empty value", () => {
    expect(parseContactMutation(form({ status: "NEW" }))).toEqual({
      ok: true,
      value: { status: "NEW", note: null },
    });
  });

  it("rejects repeated notes instead of treating them as a destructive clear", () => {
    const data = new FormData();
    data.set("status", "NEW");
    data.append("note", "keep this note");
    data.append("note", "replace this note");

    expect(parseContactMutation(data)).toEqual({
      ok: false,
      errors: { note: "Введите заметку текстом" },
      values: { status: "NEW", note: null },
    });
  });

  it("rejects a binary note without exposing its contents or filename", () => {
    const data = new FormData();
    data.set("status", "NEW");
    data.append(
      "note",
      new Blob(["private file contents"], { type: "text/plain" }),
      "private-note.txt",
    );

    const result = parseContactMutation(data);

    expect(result).toEqual({
      ok: false,
      errors: { note: "Введите заметку текстом" },
      values: { status: "NEW", note: null },
    });
    expect(JSON.stringify(result)).not.toMatch(/private file|private-note/i);
  });

  it("accepts a 4,000-character normalized note", () => {
    const note = "я".repeat(4_000);

    expect(parseContactMutation(form({ status: "NEW", note }))).toEqual({
      ok: true,
      value: { status: "NEW", note },
    });
  });

  it("counts Unicode code points when enforcing the note limit", () => {
    const note = "🙂".repeat(4_000);

    expect(parseContactMutation(form({ status: "NEW", note }))).toEqual({
      ok: true,
      value: { status: "NEW", note },
    });
  });

  it("rejects a 4,001-character normalized note and preserves only safe values", () => {
    const note = "я".repeat(4_001);

    expect(parseContactMutation(form({ status: "NEW", note }))).toEqual({
      ok: false,
      errors: { note: "Не более 4000 символов" },
      values: { status: "NEW", note },
    });
  });

  it("rejects an unsupported or repeated status", () => {
    expect(parseContactMutation(form({
      status: ["NEW", "CLOSED"],
      note: "safe note",
    }))).toEqual({
      ok: false,
      errors: { status: "Выберите статус" },
      values: { status: "", note: "safe note" },
    });
    expect(parseContactMutation(form({ status: "DELETED", note: "" }))).toEqual({
      ok: false,
      errors: { status: "Выберите статус" },
      values: { status: "DELETED", note: null },
    });
  });
});

function transactionClient(overrides: {
  current?: {
    status: ContactMutationInput["status"];
    internalNote: string | null;
    updatedAt: Date;
  } | null;
  updateCount?: number;
  auditError?: Error;
} = {}) {
  const current = overrides.current === undefined
    ? { status: "NEW" as const, internalNote: null, updatedAt }
    : overrides.current;
  const findUnique = vi.fn(async () => current);
  const updateMany = vi.fn(async () => ({ count: overrides.updateCount ?? 1 }));
  const createMany = vi.fn(async () => {
    if (overrides.auditError) throw overrides.auditError;
    return { count: 1 };
  });
  const transaction = vi.fn(async (callback: (client: {
    contactRequest: { findUnique: typeof findUnique; updateMany: typeof updateMany };
    adminAuditEvent: { createMany: typeof createMany };
  }) => Promise<UpdateContactResult>) => callback({
    contactRequest: { findUnique, updateMany },
    adminAuditEvent: { createMany },
  }));

  return {
    client: { $transaction: transaction } as unknown as NonNullable<
      Parameters<typeof updateContactRequest>[3]
    >,
    transaction,
    findUnique,
    updateMany,
    createMany,
  };
}

it("quick status updates preserve the existing private note and audit only status", async () => {
  const tx = transactionClient({ current: { status: "NEW", internalNote: "Private note", updatedAt } });
  await expect(updateContactRequest("contact-1", updatedAt, { status: "CLOSED", note: null, preserveNote: true }, tx.client)).resolves.toEqual({ status: "ok" });
  expect(tx.updateMany).toHaveBeenCalledWith({ where: { id: "contact-1", updatedAt }, data: { status: "CLOSED", internalNote: "Private note" } });
  expect(tx.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ action: "CONTACT_STATUS_CHANGED" })] });
});

it("preserves only validated return targets after a successful mutation", async () => {
  for (const [returnTo, expected] of [["/admin/messages?status=ACTIVE&page=2", "/admin/messages?status=ACTIVE&page=2"], ["https://evil.test", "/admin/messages"]]) {
    const outcome = await updateContactRequestMutation("contact-1", form({ status: "CLOSED", updatedAt: updatedAt.toISOString(), returnTo }), { requireSession: async () => undefined, parse: parseContactMutation, update: async () => ({ status: "ok" }), now: () => now });
    expect(outcome).toMatchObject({ ok: true, effect: { redirectTo: `/admin/messages/contact-1?success=saved&returnTo=${encodeURIComponent(expected!)}` } });
  }
});

describe("updateContactRequest repository", () => {
  it("reads the current safe comparison fields inside one transaction", async () => {
    const mocks = transactionClient();

    await updateContactRequest(
      "contact-1",
      updatedAt,
      { status: "IN_PROGRESS", note: null },
      mocks.client,
    );

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: "contact-1" },
      select: { status: true, internalNote: true, updatedAt: true },
    });
  });

  it("returns missing without updating or auditing", async () => {
    const mocks = transactionClient({ current: null });

    await expect(updateContactRequest(
      "missing",
      updatedAt,
      { status: "NEW", note: null },
      mocks.client,
    )).resolves.toEqual({ status: "missing" });
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("returns a stale-token conflict before considering a no-op", async () => {
    const mocks = transactionClient({
      current: {
        status: "NEW",
        internalNote: "same",
        updatedAt: new Date("2026-10-16T11:00:00.000Z"),
      },
    });

    await expect(updateContactRequest(
      "contact-1",
      updatedAt,
      { status: "NEW", note: "same" },
      mocks.client,
    )).resolves.toEqual({ status: "conflict" });
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("leaves updatedAt unchanged and writes nothing for a true no-op", async () => {
    const mocks = transactionClient({
      current: { status: "CLOSED", internalNote: "same", updatedAt },
    });

    await expect(updateContactRequest(
      "contact-1",
      updatedAt,
      { status: "CLOSED", note: "same" },
      mocks.client,
    )).resolves.toEqual({ status: "ok" });
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("optimistically updates and audits changes in the same transaction", async () => {
    const mocks = transactionClient({
      current: { status: "NEW", internalNote: "old private note", updatedAt },
    });

    await expect(updateContactRequest(
      "contact-1",
      updatedAt,
      { status: "CLOSED", note: "new private note" },
      mocks.client,
    )).resolves.toEqual({ status: "ok" });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "contact-1", updatedAt },
      data: { status: "CLOSED", internalNote: "new private note" },
    });
    expect(mocks.createMany).toHaveBeenCalledWith({
      data: [
        {
          actorKind: "ADMIN",
          action: "CONTACT_STATUS_CHANGED",
          entityType: "CONTACT_REQUEST",
          entityId: "contact-1",
          previousStatus: "NEW",
          nextStatus: "CLOSED",
        },
        {
          actorKind: "ADMIN",
          action: "CONTACT_NOTE_CHANGED",
          entityType: "CONTACT_REQUEST",
          entityId: "contact-1",
        },
      ],
    });
    expect(mocks.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createMany.mock.invocationCallOrder[0],
    );
    expect(JSON.stringify(mocks.createMany.mock.calls)).not.toContain(
      "private note",
    );
  });

  it("returns conflict and writes no audit event when the guarded update loses a race", async () => {
    const mocks = transactionClient({ updateCount: 0 });

    await expect(updateContactRequest(
      "contact-1",
      updatedAt,
      { status: "IN_PROGRESS", note: null },
      mocks.client,
    )).resolves.toEqual({ status: "conflict" });
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("rejects when audit insertion fails so the transaction cannot commit", async () => {
    const failure = new Error("audit unavailable");
    const mocks = transactionClient({ auditError: failure });

    await expect(updateContactRequest(
      "contact-1",
      updatedAt,
      { status: "IN_PROGRESS", note: null },
      mocks.client,
    )).rejects.toBe(failure);
  });
});

describe("updateContactRequestMutation", () => {
  let events: string[];
  let requireSession: () => Promise<void>;
  let parse: (data: FormData) => ReturnType<typeof parseContactMutation>;
  let update: (
    id: string,
    token: Date,
    input: ContactMutationInput,
  ) => Promise<UpdateContactResult>;
  let clock: () => Date;

  beforeEach(() => {
    events = [];
    requireSession = vi.fn(async () => { events.push("session"); });
    parse = vi.fn((data) => {
      events.push("parse");
      return parseContactMutation(data);
    });
    update = vi.fn<(
      id: string,
      token: Date,
      input: ContactMutationInput,
    ) => Promise<UpdateContactResult>>(async () => {
      events.push("repository");
      return { status: "ok" };
    });
    clock = vi.fn(() => {
      events.push("clock");
      return now;
    });
  });

  it("awaits authorization before parsing, clock access, or repository work", async () => {
    const denied = new Error("redirected");
    requireSession = vi.fn(async () => { throw denied; });

    await expect(updateContactRequestMutation("contact-1", form(), {
      requireSession,
      parse,
      update,
      now: clock,
    })).rejects.toBe(denied);
    expect(parse).not.toHaveBeenCalled();
    expect(clock).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("returns safe validation state without contact PII", async () => {
    const data = form({
      status: "INVALID",
      note: " safe note ",
      updatedAt: updatedAt.toISOString(),
      name: "Анна",
      email: "anna@example.org",
      message: "private message",
    });

    const result = await updateContactRequestMutation("contact-1", data, {
      requireSession,
      parse,
      update,
      now: clock,
    });

    expect(result).toEqual({
      ok: false,
      state: {
        status: "error",
        message: "Проверьте заполнение формы",
        errors: { status: "Выберите статус" },
        values: { status: "INVALID", note: "safe note" },
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/Анна|anna@example|private message/);
    expect(clock).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  const invalidTokenCases: Array<[string[], string]> = [
    [[], "missing"],
    [["0"], "permissive numeric date"],
    [["2026-10-16"], "date only"],
    [["10/16/2026"], "locale date"],
    [["2026-10-16T10:00:00.000+00:00"], "UTC offset"],
    [["2026-10-16T13:00:00.000+03:00"], "non-UTC offset"],
    [["2026-10-16T10:00:00Z"], "missing milliseconds"],
    [["bad-date"], "invalid"],
    [["2026-10-16T13:00:00.000Z"], "future"],
    [[updatedAt.toISOString(), updatedAt.toISOString()], "repeated"],
  ];

  it.each(invalidTokenCases)("requires exactly one valid, non-future updatedAt token: %s", async (tokens, caseName) => {
    void caseName;
    const data = form({ status: "CLOSED", note: " keep me ", updatedAt: [...tokens] });

    const result = await updateContactRequestMutation("contact-1", data, {
      requireSession,
      parse,
      update,
      now: clock,
    });

    expect(result).toEqual({
      ok: false,
      state: {
        status: "error",
        message: "Данные изменились. Обновите страницу и повторите действие",
        values: { status: "CLOSED", note: "keep me" },
      },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("accepts an exact UTC ISO updatedAt token with milliseconds", async () => {
    await updateContactRequestMutation("contact-1", form({
      status: "CLOSED",
      note: "keep me",
      updatedAt: "2026-10-16T10:00:00.000Z",
    }), {
      requireSession,
      parse,
      update,
      now: clock,
    });

    expect(update).toHaveBeenCalledWith(
      "contact-1",
      updatedAt,
      { status: "CLOSED", note: "keep me" },
    );
  });

  it.each(["missing", "conflict"] as const)(
    "maps repository %s to a conflict while preserving safe submitted values",
    async (status) => {
      update = vi.fn(async () => ({ status }));

      const result = await updateContactRequestMutation("contact-1", form(), {
        requireSession,
        parse,
        update,
        now: clock,
      });

      expect(result).toEqual({
        ok: false,
        state: {
          status: "error",
          message: "Данные изменились. Обновите страницу и повторите действие",
          values: { status: "IN_PROGRESS", note: "Позвонить утром" },
        },
      });
    },
  );

  it("returns the message-list and dashboard success effect", async () => {
    const result = await updateContactRequestMutation("contact-1", form(), {
      requireSession,
      parse,
      update,
      now: clock,
    });

    expect(events).toEqual(["session", "parse", "clock", "repository"]);
    expect(update).toHaveBeenCalledWith(
      "contact-1",
      updatedAt,
      { status: "IN_PROGRESS", note: "Позвонить утром" },
    );
    expect(result).toEqual({
      ok: true,
      effect: {
        revalidate: ["/admin", "/admin/messages"],
        redirectTo: "/admin/messages/contact-1?success=saved",
      },
    });
  });
});
