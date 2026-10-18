import { describe, expect, it, vi } from "vitest";

import {
  createAuditedDocument,
  createAuditedNews,
  createAuditedProject,
  deleteAuditedDocument,
  deleteAuditedNews,
  deleteAuditedProject,
  updateAuditedDocument,
  updateAuditedNews,
  updateAuditedProject,
} from "./content-repository";

const updatedAt = new Date("2026-10-16T10:00:00.000Z");

const editorialInput = {
  title: "Private title",
  slug: "private-slug",
  summary: "Private summary",
  content: "Private content",
  imageUrl: "/private.jpg",
  status: "DRAFT" as const,
};

const projectInput = {
  ...editorialInput,
  goalAmountKopecks: null,
  manualRaisedKopecks: 0,
};

const documentInput = {
  title: "Private document",
  category: "ANNUAL",
  fileUrl: "/private.pdf",
  status: "DRAFT" as const,
};

function transactionClient(transaction: object) {
  const $transaction = vi.fn(async (callback: (tx: never) => Promise<unknown>) =>
    callback(transaction as never));
  return { $transaction };
}

describe("audited content creates", () => {
  it.each([
    ["project", createAuditedProject, "project", "PROJECT", projectInput],
    ["news", createAuditedNews, "newsPost", "NEWS_POST", editorialInput],
    ["document", createAuditedDocument, "document", "DOCUMENT", documentInput],
  ] as const)("creates and audits %s in one transaction", async (
    _label,
    create,
    model,
    entityType,
    input,
  ) => {
    const createRow = vi.fn(async () => ({
      id: `${model}-1`,
      ...(model === "document" ? {} : { slug: "private-slug" }),
      status: "DRAFT" as const,
      publishedAt: null,
    }));
    const createMany = vi.fn(async () => ({ count: 1 }));
    const transaction = {
      [model]: { create: createRow },
      adminAuditEvent: { createMany },
    };
    const client = transactionClient(transaction);

    await expect(create(input as never, client as never)).resolves.toMatchObject({
      status: "ok",
      previousStatus: null,
      publicationStatus: "DRAFT",
    });

    expect(client.$transaction).toHaveBeenCalledOnce();
    expect(createMany).toHaveBeenCalledExactlyOnceWith({
      data: [{
        actorKind: "ADMIN",
        action: "CONTENT_CREATED",
        entityType,
        entityId: `${model}-1`,
        nextStatus: "DRAFT",
      }],
    });
  });

  it.each([
    ["PUBLISHED", "CONTENT_PUBLISHED"],
    ["ARCHIVED", "CONTENT_ARCHIVED"],
  ] as const)("writes two events for a directly created %s project", async (status, action) => {
    const createMany = vi.fn(async () => ({ count: 2 }));
    const transaction = {
      project: {
        create: vi.fn(async () => ({
          id: "project-1",
          slug: "private-slug",
          status,
          publishedAt: status === "PUBLISHED" ? updatedAt : null,
        })),
      },
      adminAuditEvent: { createMany },
    };

    await createAuditedProject(
      { ...projectInput, status },
      transactionClient(transaction) as never,
    );

    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ action: "CONTENT_CREATED", nextStatus: status }),
        expect.objectContaining({ action, nextStatus: status }),
      ],
    });
  });

  it("does not audit a duplicate editorial create", async () => {
    const createMany = vi.fn();
    const transaction = {
      project: { create: vi.fn(async () => { throw { code: "P2002" }; }) },
      adminAuditEvent: { createMany },
    };

    await expect(
      createAuditedProject(projectInput, transactionClient(transaction) as never),
    ).resolves.toEqual({ status: "duplicate" });
    expect(createMany).not.toHaveBeenCalled();
  });
});
describe("audited content updates", () => {
  it.each([
    ["project", updateAuditedProject, "project", "PROJECT", projectInput],
    ["news", updateAuditedNews, "newsPost", "NEWS_POST", editorialInput],
    ["document", updateAuditedDocument, "document", "DOCUMENT", documentInput],
  ] as const)("audits an exact %s publish transition", async (
    _label,
    update,
    model,
    entityType,
    input,
  ) => {
    const current = {
      id: `${model}-1`,
      ...(model === "document" ? {} : { slug: "old-slug" }),
      status: "DRAFT" as const,
      publishedAt: null,
    };
    const createMany = vi.fn(async () => ({ count: 1 }));
    const transaction = {
      [model]: {
        findUnique: vi.fn(async () => current),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      adminAuditEvent: { createMany },
    };

    await expect(update(
      `${model}-1`,
      updatedAt,
      { ...input, status: "PUBLISHED" } as never,
      transactionClient(transaction) as never,
    )).resolves.toMatchObject({
      status: "ok",
      previousStatus: "DRAFT",
      publicationStatus: "PUBLISHED",
    });

    expect(createMany).toHaveBeenCalledExactlyOnceWith({
      data: [{
        actorKind: "ADMIN",
        action: "CONTENT_PUBLISHED",
        entityType,
        entityId: `${model}-1`,
        previousStatus: "DRAFT",
        nextStatus: "PUBLISHED",
      }],
    });
  });

  it("does not insert an audit row when a successful update keeps its status", async () => {
    const createMany = vi.fn();
    const transaction = {
      document: {
        findUnique: vi.fn(async () => ({
          id: "document-1",
          status: "DRAFT" as const,
          publishedAt: null,
        })),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      adminAuditEvent: { createMany },
    };

    await expect(updateAuditedDocument(
      "document-1",
      updatedAt,
      documentInput,
      transactionClient(transaction) as never,
    )).resolves.toMatchObject({ status: "ok" });
    expect(createMany).not.toHaveBeenCalled();
  });

  it.each(["missing", "conflict"] as const)(
    "does not audit a %s update result",
    async (outcome) => {
      const createMany = vi.fn();
      const transaction = {
        document: {
          findUnique: vi.fn(async () => outcome === "missing" ? null : ({
            id: "document-1",
            status: "DRAFT" as const,
            publishedAt: null,
          })),
          updateMany: vi.fn(async () => ({ count: 0 })),
        },
        adminAuditEvent: { createMany },
      };

      await expect(updateAuditedDocument(
        "document-1",
        updatedAt,
        { ...documentInput, status: "ARCHIVED" },
        transactionClient(transaction) as never,
      )).resolves.toEqual({ status: outcome });
      expect(createMany).not.toHaveBeenCalled();
    },
  );
});

describe("audited content deletes", () => {
  it.each([
    ["project", deleteAuditedProject, "project", "PROJECT"],
    ["news", deleteAuditedNews, "newsPost", "NEWS_POST"],
    ["document", deleteAuditedDocument, "document", "DOCUMENT"],
  ] as const)("deletes and audits %s atomically", async (
    _label,
    remove,
    model,
    entityType,
  ) => {
    const createMany = vi.fn(async () => ({ count: 1 }));
    const transaction = {
      [model]: { deleteMany: vi.fn(async () => ({ count: 1 })) },
      adminAuditEvent: { createMany },
    };

    await expect(remove(
      `${model}-1`,
      updatedAt,
      transactionClient(transaction) as never,
    )).resolves.toEqual({ status: "ok", id: `${model}-1` });
    expect(createMany).toHaveBeenCalledExactlyOnceWith({
      data: [{
        actorKind: "ADMIN",
        action: "CONTENT_DELETED",
        entityType,
        entityId: `${model}-1`,
        previousStatus: "DRAFT",
      }],
    });
  });

  it("does not audit a forbidden delete", async () => {
    const createMany = vi.fn();
    const transaction = {
      document: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      adminAuditEvent: { createMany },
    };

    await expect(deleteAuditedDocument(
      "document-1",
      updatedAt,
      transactionClient(transaction) as never,
    )).resolves.toEqual({ status: "forbidden" });
    expect(createMany).not.toHaveBeenCalled();
  });

  it("propagates an audit failure so the transaction can roll back", async () => {
    const failure = new Error("audit unavailable");
    const transaction = {
      document: { deleteMany: vi.fn(async () => ({ count: 1 })) },
      adminAuditEvent: { createMany: vi.fn(async () => { throw failure; }) },
    };

    await expect(deleteAuditedDocument(
      "document-1",
      updatedAt,
      transactionClient(transaction) as never,
    )).rejects.toBe(failure);
  });
});
