import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth/session";

import { contactAuditEvents, type ContactAuditEvent } from "../admin-audit/events";
import { CONTACT_STATUSES, type ContactStatusValue } from "./types";

const VALIDATION_MESSAGE = "Проверьте заполнение формы";
const CONFLICT_MESSAGE =
  "Данные изменились. Обновите страницу и повторите действие";
const NOTE_MAX_LENGTH = 4_000;

export type ContactMutationInput = {
  status: ContactStatusValue;
  note: string | null;
};

export type ContactMutationValues = {
  status: string;
  note: string | null;
};

export type ContactMutationState = {
  status: "idle" | "error";
  message: string;
  errors?: Partial<Record<keyof ContactMutationValues, string>>;
  values?: ContactMutationValues;
};

export type ContactMutationEffect = {
  revalidate: string[];
  redirectTo: string;
};

export type ContactMutationOutcome =
  | { ok: false; state: ContactMutationState }
  | { ok: true; effect: ContactMutationEffect };

export type ParseContactMutationResult =
  | { ok: true; value: ContactMutationInput }
  | {
      ok: false;
      errors: Partial<Record<keyof ContactMutationValues, string>>;
      values: ContactMutationValues;
    };

export type UpdateContactResult =
  | { status: "ok" }
  | { status: "missing" | "conflict" };

type ContactCurrent = {
  status: ContactStatusValue;
  internalNote: string | null;
  updatedAt: Date;
};

type ContactMutationTransaction = {
  contactRequest: {
    findUnique(args: {
      where: { id: string };
      select: { status: true; internalNote: true; updatedAt: true };
    }): Promise<ContactCurrent | null>;
    updateMany(args: {
      where: { id: string; updatedAt: Date };
      data: { status: ContactStatusValue; internalNote: string | null };
    }): Promise<{ count: number }>;
  };
  adminAuditEvent: {
    createMany(args: { data: ContactAuditEvent[] }): Promise<unknown>;
  };
};

type ContactMutationClient = {
  $transaction(
    callback: (
      transaction: ContactMutationTransaction,
    ) => Promise<UpdateContactResult>,
  ): Promise<UpdateContactResult>;
};

type ContactMutationDependencies = {
  requireSession: () => Promise<unknown>;
  parse: (formData: FormData) => ParseContactMutationResult;
  update: (
    id: string,
    expectedUpdatedAt: Date,
    input: ContactMutationInput,
  ) => Promise<UpdateContactResult>;
  now: () => Date;
};

function oneString(formData: FormData, key: string): string | undefined {
  const entries = formData.getAll(key);
  if (entries.length !== 1 || typeof entries[0] !== "string") return undefined;
  return entries[0];
}

export function parseContactMutation(
  formData: FormData,
): ParseContactMutationResult {
  const rawStatus = oneString(formData, "status");
  const rawNote = oneString(formData, "note") ?? "";
  const note = rawNote.trim() || null;
  const values: ContactMutationValues = {
    status: rawStatus ?? "",
    note,
  };
  const errors: Partial<Record<keyof ContactMutationValues, string>> = {};

  if (!rawStatus || !CONTACT_STATUSES.includes(rawStatus as ContactStatusValue)) {
    errors.status = "Выберите статус";
  }
  if (note && Array.from(note).length > NOTE_MAX_LENGTH) {
    errors.note = "Не более 4000 символов";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors, values };
  return {
    ok: true,
    value: { status: rawStatus as ContactStatusValue, note },
  };
}

export async function updateContactRequest(
  id: string,
  expectedUpdatedAt: Date,
  input: ContactMutationInput,
  client: ContactMutationClient = prisma as unknown as ContactMutationClient,
): Promise<UpdateContactResult> {
  return client.$transaction(async (transaction) => {
    const current = await transaction.contactRequest.findUnique({
      where: { id },
      select: { status: true, internalNote: true, updatedAt: true },
    });

    if (!current) return { status: "missing" };
    if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      return { status: "conflict" };
    }

    const noteChanged = current.internalNote !== input.note;
    if (current.status === input.status && !noteChanged) return { status: "ok" };

    const updated = await transaction.contactRequest.updateMany({
      where: { id, updatedAt: expectedUpdatedAt },
      data: { status: input.status, internalNote: input.note },
    });
    if (updated.count === 0) return { status: "conflict" };

    await transaction.adminAuditEvent.createMany({
      data: contactAuditEvents({
        id,
        previousStatus: current.status,
        status: input.status,
        noteChanged,
      }),
    });

    return { status: "ok" };
  });
}

function conflict(values: ContactMutationValues): ContactMutationOutcome {
  return {
    ok: false,
    state: {
      status: "error",
      message: CONFLICT_MESSAGE,
      values,
    },
  };
}

function readUpdatedAt(formData: FormData, now: Date): Date | undefined {
  const raw = oneString(formData, "updatedAt");
  if (!raw) return undefined;

  const value = new Date(raw);
  if (!Number.isFinite(value.getTime()) || value.getTime() > now.getTime()) {
    return undefined;
  }
  return value;
}

const defaultDependencies: ContactMutationDependencies = {
  requireSession: requireAdminSession,
  parse: parseContactMutation,
  update: updateContactRequest,
  now: () => new Date(),
};

export async function updateContactRequestMutation(
  id: string,
  formData: FormData,
  dependencies: ContactMutationDependencies = defaultDependencies,
): Promise<ContactMutationOutcome> {
  await dependencies.requireSession();
  const parsed = dependencies.parse(formData);
  if (!parsed.ok) {
    return {
      ok: false,
      state: {
        status: "error",
        message: VALIDATION_MESSAGE,
        errors: parsed.errors,
        values: parsed.values,
      },
    };
  }

  const expectedUpdatedAt = readUpdatedAt(formData, dependencies.now());
  if (!expectedUpdatedAt) {
    return conflict({ status: parsed.value.status, note: parsed.value.note });
  }

  const result = await dependencies.update(id, expectedUpdatedAt, parsed.value);
  if (result.status !== "ok") {
    return conflict({ status: parsed.value.status, note: parsed.value.note });
  }

  return {
    ok: true,
    effect: {
      revalidate: ["/admin", "/admin/messages"],
      redirectTo: `/admin/messages/${id}?success=saved`,
    },
  };
}
