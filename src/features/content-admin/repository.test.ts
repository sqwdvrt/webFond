import { describe, expect, it, vi } from "vitest";

import { defaultRequisitesDraft } from "./validation";
import {
  createDocument,
  createNews,
  createProject,
  deleteDocument,
  deleteNews,
  deleteProject,
  getAdminDocument,
  getAdminNews,
  getAdminProject,
  getAdminRequisites,
  getPublishedNewsPost,
  getPublishedProject,
  getPublishedRequisites,
  listAdminDocuments,
  listAdminNews,
  listAdminProjects,
  listPublishedDocuments,
  listPublishedNews,
  listPublishedProjects,
  replaceInvalidRequisites,
  saveRequisites,
  updateDocument,
  updateNews,
  updateProject,
} from "./repository";

const updatedAt = new Date("2026-08-23T10:00:00.000Z");
const publishedAt = new Date("2026-08-22T10:00:00.000Z");

const adminEditorialRow = {
  id: "entry-1",
  title: "Запись",
  slug: "entry-1",
  summary: "Кратко",
  content: "Полный текст",
  imageUrl: "/entry.jpg",
  status: "PUBLISHED" as const,
  publishedAt,
  updatedAt,
};

const adminDocumentRow = {
  id: "document-1",
  title: "Отчет",
  category: "ANNUAL",
  fileUrl: "/report.pdf",
  status: "PUBLISHED" as const,
  publishedAt,
  updatedAt,
};

const adminEditorialListRow = {
  id: adminEditorialRow.id,
  title: adminEditorialRow.title,
  slug: adminEditorialRow.slug,
  status: adminEditorialRow.status,
  publishedAt: adminEditorialRow.publishedAt,
  updatedAt: adminEditorialRow.updatedAt,
};

const adminDocumentListRow = {
  id: adminDocumentRow.id,
  title: adminDocumentRow.title,
  category: adminDocumentRow.category,
  status: adminDocumentRow.status,
  publishedAt: adminDocumentRow.publishedAt,
  updatedAt: adminDocumentRow.updatedAt,
};

const publicEditorialListRow = {
  id: adminEditorialRow.id,
  title: adminEditorialRow.title,
  slug: adminEditorialRow.slug,
  summary: adminEditorialRow.summary,
  imageUrl: adminEditorialRow.imageUrl,
  publishedAt: adminEditorialRow.publishedAt,
};

const publicDocumentRow = {
  id: adminDocumentRow.id,
  title: adminDocumentRow.title,
  category: adminDocumentRow.category,
  fileUrl: adminDocumentRow.fileUrl,
  publishedAt: adminDocumentRow.publishedAt,
};

const validPublishedRequisites = {
  ...defaultRequisitesDraft(),
  status: "PUBLISHED" as const,
  bankName: "АО Банк",
  recipientName: "Фонд «Быть Добру»",
  checkingAccount: "40703810100000000001",
  correspondentAccount: "30101810000000000001",
  bik: "044525001",
};

const draftEditorialInput = {
  title: "Новая запись",
  slug: "new-entry",
  summary: "Кратко",
  content: "Полный текст",
  imageUrl: "/new-entry.jpg",
  status: "DRAFT" as const,
};

const draftDocumentInput = {
  title: "Новый отчет",
  category: "ANNUAL",
  fileUrl: "/new-report.pdf",
  status: "DRAFT" as const,
};

const adminEditorialListSelect = {
  id: true,
  title: true,
  slug: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
};

const adminEditorialDetailSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  content: true,
  imageUrl: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
};

const publicEditorialListSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  imageUrl: true,
  publishedAt: true,
};

const publicEditorialDetailSelect = {
  ...publicEditorialListSelect,
  content: true,
};

const adminDocumentListSelect = {
  id: true,
  title: true,
  category: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
};

const adminDocumentDetailSelect = {
  id: true,
  title: true,
  category: true,
  fileUrl: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
};

const publicDocumentSelect = {
  id: true,
  title: true,
  category: true,
  fileUrl: true,
  publishedAt: true,
};

describe("content repository admin reads", () => {
  it.each([
    ["projects", listAdminProjects, "project", adminEditorialListRow, adminEditorialListSelect],
    ["news", listAdminNews, "newsPost", adminEditorialListRow, adminEditorialListSelect],
    ["documents", listAdminDocuments, "document", adminDocumentListRow, adminDocumentListSelect],
  ] as const)(
    "lists %s by updatedAt and id so equal timestamps are deterministic",
    async (_label, list, model, row, select) => {
      const findMany = vi.fn(async () => [row]);
      const client = { [model]: { findMany } };

      await expect(list(client as never)).resolves.toEqual([row]);

      expect(findMany).toHaveBeenCalledExactlyOnceWith({
        select,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      });
    },
  );

  it.each([
    ["project", getAdminProject, "project", adminEditorialRow, adminEditorialDetailSelect],
    ["news post", getAdminNews, "newsPost", adminEditorialRow, adminEditorialDetailSelect],
    ["document", getAdminDocument, "document", adminDocumentRow, adminDocumentDetailSelect],
  ] as const)(
    "gets an admin %s by id with its optimistic-lock token",
    async (_label, get, model, row, select) => {
      const findUnique = vi.fn(async () => row);
      const client = { [model]: { findUnique } };

      await expect(get(row.id, client as never)).resolves.toEqual(row);
      expect(findUnique).toHaveBeenCalledExactlyOnceWith({
        where: { id: row.id },
        select,
      });
    },
  );

  it("returns null for a missing admin record", async () => {
    const findUnique = vi.fn(async () => null);

    await expect(
      getAdminProject("missing", { project: { findUnique } }),
    ).resolves.toBeNull();
  });

  it("does not translate dependency failures on admin reads", async () => {
    const failure = new Error("database unavailable");
    const findMany = vi.fn(async () => {
      throw failure;
    });

    await expect(
      listAdminNews({ newsPost: { findMany } }),
    ).rejects.toBe(failure);
  });
});

describe("content repository public reads", () => {
  it.each([
    ["projects", listPublishedProjects, "project", publicEditorialListSelect, publicEditorialListRow],
    ["news", listPublishedNews, "newsPost", publicEditorialListSelect, publicEditorialListRow],
    ["documents", listPublishedDocuments, "document", publicDocumentSelect, publicDocumentRow],
  ] as const)(
    "lists only published %s in deterministic publication order",
    async (_label, list, model, select, row) => {
      const rows = [
        { ...row, id: "same-time-z" },
        { ...row, id: "same-time-a" },
      ];
      const findMany = vi.fn(async () => rows);
      const client = { [model]: { findMany } };

      await expect(list(client as never)).resolves.toBe(rows);
      expect(findMany).toHaveBeenCalledExactlyOnceWith({
        where: { status: "PUBLISHED" },
        select,
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      });
    },
  );

  it.each([
    ["project", getPublishedProject, "project"],
    ["news post", getPublishedNewsPost, "newsPost"],
  ] as const)(
    "gets a published %s by slug without selecting admin-only fields",
    async (_label, get, model) => {
      const row = {
        id: "entry-1",
        title: "Запись",
        slug: "entry-1",
        summary: "Кратко",
        content: "Полный текст",
        imageUrl: "/entry.jpg",
        publishedAt,
      };
      const findFirst = vi.fn(async () => row);
      const client = { [model]: { findFirst } };

      await expect(get("entry-1", client as never)).resolves.toEqual(row);
      expect(findFirst).toHaveBeenCalledExactlyOnceWith({
        where: { slug: "entry-1", status: "PUBLISHED" },
        select: publicEditorialDetailSelect,
      });
    },
  );

  it("returns null for missing published detail", async () => {
    const findFirst = vi.fn(async () => null);

    await expect(
      getPublishedNewsPost("missing", { newsPost: { findFirst } }),
    ).resolves.toBeNull();
  });

  it("does not translate dependency failures on public detail", async () => {
    const failure = new Error("database unavailable");
    const findFirst = vi.fn(async () => {
      throw failure;
    });

    await expect(
      getPublishedProject("entry-1", { project: { findFirst } }),
    ).rejects.toBe(failure);
  });
});

describe("content repository requisites reads", () => {
  it("returns a safe draft when the admin setting is missing", async () => {
    const findUnique = vi.fn(async () => null);

    await expect(
      getAdminRequisites({ siteSetting: { findUnique } }),
    ).resolves.toEqual({
      status: "missing",
      value: defaultRequisitesDraft(),
      updatedAt: null,
    });
    expect(findUnique).toHaveBeenCalledExactlyOnceWith({
      where: { key: "requisites" },
      select: { value: true, updatedAt: true },
    });
  });

  it("returns a validated admin setting and update token", async () => {
    const findUnique = vi.fn(async () => ({
      value: validPublishedRequisites,
      updatedAt,
    }));

    await expect(
      getAdminRequisites({ siteSetting: { findUnique } }),
    ).resolves.toEqual({
      status: "ok",
      value: validPublishedRequisites,
      updatedAt,
    });
  });

  it("returns a recoverable invalid result without malformed values", async () => {
    const findUnique = vi.fn(async () => ({
      value: { ...validPublishedRequisites, inn: "not-an-inn" },
      updatedAt,
    }));

    const result = await getAdminRequisites({ siteSetting: { findUnique } });

    expect(result).toEqual({ status: "invalid", updatedAt });
    expect(result).not.toHaveProperty("value");
  });

  it("does not translate admin requisites dependency failures", async () => {
    const failure = new Error("database unavailable");
    const findUnique = vi.fn(async () => {
      throw failure;
    });

    await expect(
      getAdminRequisites({ siteSetting: { findUnique } }),
    ).rejects.toBe(failure);
  });

  it("exposes only valid published requisites", async () => {
    const findUnique = vi.fn(async () => ({ value: validPublishedRequisites }));

    await expect(
      getPublishedRequisites({ siteSetting: { findUnique } }),
    ).resolves.toEqual({
      status: "published",
      value: validPublishedRequisites,
    });
    expect(findUnique).toHaveBeenCalledExactlyOnceWith({
      where: { key: "requisites" },
      select: { value: true },
    });
  });

  it.each([
    ["missing", null],
    ["draft", { value: defaultRequisitesDraft() }],
    ["archived", { value: { ...defaultRequisitesDraft(), status: "ARCHIVED" } }],
    ["malformed", { value: { ...validPublishedRequisites, bik: "secret malformed value" } }],
  ])("fails closed for %s public requisites", async (_label, stored) => {
    const findUnique = vi.fn(async () => stored);

    const result = await getPublishedRequisites({ siteSetting: { findUnique } });

    expect(result).toEqual({
      status: "fallback",
      value: defaultRequisitesDraft(),
    });
    expect(result.value.bankName).toBe("");
    expect(result.value).not.toHaveProperty("secret");
  });

  it("does not translate public requisites dependency failures", async () => {
    const failure = new Error("database unavailable");
    const findUnique = vi.fn(async () => {
      throw failure;
    });

    await expect(
      getPublishedRequisites({ siteSetting: { findUnique } }),
    ).rejects.toBe(failure);
  });
});

describe("content repository creates", () => {
  it.each([
    ["project", createProject, "project", draftEditorialInput, "project-1", "new-entry"],
    ["news post", createNews, "newsPost", draftEditorialInput, "news-1", "new-entry"],
  ] as const)(
    "creates a normalized draft %s and returns cache-relevant state",
    async (_label, create, model, input, id, slug) => {
      const createQuery = vi.fn(async () => ({
        id,
        slug,
        status: "DRAFT" as const,
        publishedAt: null,
      }));
      const client = { [model]: { create: createQuery } };

      await expect(create(input, client as never)).resolves.toEqual({
        status: "ok",
        id,
        previousSlug: null,
        slug,
        wasPublished: false,
        isPublished: false,
        publishedAt: null,
      });
      expect(createQuery).toHaveBeenCalledExactlyOnceWith({
        data: { ...input, publishedAt: null },
        select: {
          id: true,
          slug: true,
          status: true,
          publishedAt: true,
        },
      });
    },
  );

  it("uses the current time for a project's first publication", async () => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const createQuery = vi.fn(async () => ({
      id: "project-1",
      slug: "new-entry",
      status: "PUBLISHED" as const,
      publishedAt: now,
    }));

    try {
      await createProject(
        { ...draftEditorialInput, status: "PUBLISHED" },
        { project: { create: createQuery } },
      );
    } finally {
      vi.useRealTimers();
    }

    expect(createQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ publishedAt: now }),
      }),
    );
  });

  it("creates documents with a narrow result projection", async () => {
    const createQuery = vi.fn(async () => ({
      id: "document-1",
      status: "DRAFT" as const,
      publishedAt: null,
    }));

    await expect(
      createDocument(draftDocumentInput, { document: { create: createQuery } }),
    ).resolves.toEqual({
      status: "ok",
      id: "document-1",
      wasPublished: false,
      isPublished: false,
      publishedAt: null,
    });
    expect(createQuery).toHaveBeenCalledExactlyOnceWith({
      data: { ...draftDocumentInput, publishedAt: null },
      select: {
        id: true,
        status: true,
        publishedAt: true,
      },
    });
  });

  it.each([
    ["project", createProject, "project", draftEditorialInput],
    ["news post", createNews, "newsPost", draftEditorialInput],
  ] as const)("maps a %s P2002 create failure to duplicate", async (_label, create, model, input) => {
    const createQuery = vi.fn(async () => {
      throw { code: "P2002", message: "sensitive database detail" };
    });

    const result = await create(input as never, { [model]: { create: createQuery } } as never);

    expect(result).toEqual({ status: "duplicate" });
    expect(result).not.toHaveProperty("message");
  });

  it("does not translate document create failures", async () => {
    const failure = new Error("database unavailable");
    const createQuery = vi.fn(async () => {
      throw failure;
    });

    await expect(
      createDocument(draftDocumentInput, { document: { create: createQuery } }),
    ).rejects.toBe(failure);
  });

  it("does not translate non-P2002 editorial create failures", async () => {
    const failure = Object.assign(new Error("database unavailable"), {
      code: "P2025",
    });
    const createQuery = vi.fn(async () => {
      throw failure;
    });

    await expect(
      createNews(draftEditorialInput, { newsPost: { create: createQuery } }),
    ).rejects.toBe(failure);
  });
});

describe("content repository updates", () => {
  it.each([
    ["project", updateProject, "project", "old-project", "old-project", "new-entry"],
    ["news post", updateNews, "newsPost", "old-news", "old-news", "new-entry"],
  ] as const)(
    "updates a %s through id and updatedAt and returns old/new publication state",
    async (_label, update, model, id, previousSlug, slug) => {
      const findUnique = vi.fn(async () => ({
        id,
        slug: previousSlug,
        status: "PUBLISHED" as const,
        publishedAt,
      }));
      const updateMany = vi.fn(async () => ({ count: 1 }));
      const client = { [model]: { findUnique, updateMany } };
      const input = { ...draftEditorialInput, slug, status: "ARCHIVED" as const };

      await expect(
        update(id, updatedAt, input, client as never),
      ).resolves.toEqual({
        status: "ok",
        id,
        previousSlug,
        slug,
        wasPublished: true,
        isPublished: false,
        publishedAt,
      });
      expect(findUnique).toHaveBeenCalledExactlyOnceWith({
        where: { id },
        select: {
          id: true,
          slug: true,
          status: true,
          publishedAt: true,
        },
      });
      expect(updateMany).toHaveBeenCalledExactlyOnceWith({
        where: { id, updatedAt },
        data: { ...input, publishedAt },
      });
    },
  );

  it("preserves a document's first publication timestamp when returning to draft", async () => {
    const findUnique = vi.fn(async () => ({
      id: "document-1",
      status: "PUBLISHED" as const,
      publishedAt,
    }));
    const updateMany = vi.fn(async () => ({ count: 1 }));

    await expect(
      updateDocument("document-1", updatedAt, draftDocumentInput, {
        document: { findUnique, updateMany },
      }),
    ).resolves.toEqual({
      status: "ok",
      id: "document-1",
      wasPublished: true,
      isPublished: false,
      publishedAt,
    });
    expect(updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { id: "document-1", updatedAt },
      data: { ...draftDocumentInput, publishedAt },
    });
  });

  it("assigns the first publication timestamp during update", async () => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const findUnique = vi.fn(async () => ({
      id: "project-1",
      slug: "old-project",
      status: "DRAFT" as const,
      publishedAt: null,
    }));
    const updateMany = vi.fn(async () => ({ count: 1 }));

    try {
      await updateProject(
        "project-1",
        updatedAt,
        { ...draftEditorialInput, status: "PUBLISHED" },
        { project: { findUnique, updateMany } },
      );
    } finally {
      vi.useRealTimers();
    }

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ publishedAt: now }) }),
    );
  });

  it("returns missing without attempting an update when the record is absent", async () => {
    const findUnique = vi.fn(async () => null);
    const updateMany = vi.fn(async () => ({ count: 1 }));

    await expect(
      updateProject("missing", updatedAt, draftEditorialInput, {
        project: { findUnique, updateMany },
      }),
    ).resolves.toEqual({ status: "missing" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("maps a zero update count to a neutral conflict", async () => {
    const findUnique = vi.fn(async () => ({
      id: "document-1",
      status: "DRAFT" as const,
      publishedAt: null,
    }));
    const updateMany = vi.fn(async () => ({ count: 0 }));

    await expect(
      updateDocument("document-1", updatedAt, draftDocumentInput, {
        document: { findUnique, updateMany },
      }),
    ).resolves.toEqual({ status: "conflict" });
  });

  it("maps an editorial P2002 update failure to duplicate without leaking details", async () => {
    const findUnique = vi.fn(async () => ({
      id: "project-1",
      slug: "old-project",
      status: "DRAFT" as const,
      publishedAt: null,
    }));
    const updateMany = vi.fn(async () => {
      throw { code: "P2002", message: "sensitive database detail" };
    });

    const result = await updateProject("project-1", updatedAt, draftEditorialInput, {
      project: { findUnique, updateMany },
    });

    expect(result).toEqual({ status: "duplicate" });
    expect(result).not.toHaveProperty("message");
  });

  it("does not translate other update failures", async () => {
    const failure = new Error("database unavailable");
    const findUnique = vi.fn(async () => ({
      id: "document-1",
      status: "DRAFT" as const,
      publishedAt: null,
    }));
    const updateMany = vi.fn(async () => {
      throw failure;
    });

    await expect(
      updateDocument("document-1", updatedAt, draftDocumentInput, {
        document: { findUnique, updateMany },
      }),
    ).rejects.toBe(failure);
  });
});

describe("content repository deletes", () => {
  it.each([
    ["project", deleteProject, "project"],
    ["news post", deleteNews, "newsPost"],
    ["document", deleteDocument, "document"],
  ] as const)("deletes a draft %s with the exact guarded where", async (_label, remove, model) => {
    const deleteMany = vi.fn(async () => ({ count: 1 }));

    await expect(
      remove("entry-1", updatedAt, { [model]: { deleteMany } } as never),
    ).resolves.toEqual({ status: "ok", id: "entry-1" });
    expect(deleteMany).toHaveBeenCalledExactlyOnceWith({
      where: {
        id: "entry-1",
        updatedAt,
        status: "DRAFT",
        publishedAt: null,
      },
    });
  });

  it("maps a zero delete count to a neutral forbidden result", async () => {
    const deleteMany = vi.fn(async () => ({ count: 0 }));

    await expect(
      deleteNews("news-1", updatedAt, { newsPost: { deleteMany } }),
    ).resolves.toEqual({ status: "forbidden" });
  });

  it("does not translate delete dependency failures", async () => {
    const failure = new Error("database unavailable");
    const deleteMany = vi.fn(async () => {
      throw failure;
    });

    await expect(
      deleteDocument("document-1", updatedAt, { document: { deleteMany } }),
    ).rejects.toBe(failure);
  });
});

describe("content repository requisites mutations", () => {
  it("creates the initial requisites setting when no token exists", async () => {
    const createQuery = vi.fn(async () => ({ updatedAt }));

    await expect(
      saveRequisites(defaultRequisitesDraft(), null, {
        siteSetting: { create: createQuery, updateMany: vi.fn() },
      }),
    ).resolves.toEqual({ status: "ok", updatedAt });
    expect(createQuery).toHaveBeenCalledExactlyOnceWith({
      data: { key: "requisites", value: defaultRequisitesDraft() },
      select: { updatedAt: true },
    });
  });

  it("maps a concurrent initial create to conflict", async () => {
    const createQuery = vi.fn(async () => {
      throw { code: "P2002", message: "sensitive database detail" };
    });

    const result = await saveRequisites(defaultRequisitesDraft(), null, {
      siteSetting: { create: createQuery, updateMany: vi.fn() },
    });

    expect(result).toEqual({ status: "conflict" });
    expect(result).not.toHaveProperty("message");
  });

  it("does not translate other initial create failures", async () => {
    const failure = new Error("database unavailable");
    const createQuery = vi.fn(async () => {
      throw failure;
    });

    await expect(
      saveRequisites(defaultRequisitesDraft(), null, {
        siteSetting: { create: createQuery, updateMany: vi.fn() },
      }),
    ).rejects.toBe(failure);
  });

  it("updates requisites by key and optimistic token", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));

    await expect(
      saveRequisites(validPublishedRequisites, updatedAt, {
        siteSetting: { create: vi.fn(), updateMany },
      }),
    ).resolves.toEqual({ status: "ok" });
    expect(updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { key: "requisites", updatedAt },
      data: { value: validPublishedRequisites },
    });
  });

  it("maps a zero requisites update count to conflict", async () => {
    const updateMany = vi.fn(async () => ({ count: 0 }));

    await expect(
      saveRequisites(defaultRequisitesDraft(), updatedAt, {
        siteSetting: { create: vi.fn(), updateMany },
      }),
    ).resolves.toEqual({ status: "conflict" });
  });

  it("replaces malformed requisites with the validator's safe draft", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));

    await expect(
      replaceInvalidRequisites(
        updatedAt,
        undefined,
        { siteSetting: { updateMany } },
      ),
    ).resolves.toEqual({ status: "ok" });
    expect(updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { key: "requisites", updatedAt },
      data: { value: defaultRequisitesDraft() },
    });
  });

  it("accepts a provided runtime-valid safe draft replacement", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const safeDraft = { ...defaultRequisitesDraft(), shortName: "БД" };

    await expect(
      replaceInvalidRequisites(updatedAt, safeDraft, {
        siteSetting: { updateMany },
      }),
    ).resolves.toEqual({ status: "ok" });
    expect(updateMany).toHaveBeenCalledWith({
      where: { key: "requisites", updatedAt },
      data: { value: safeDraft },
    });
  });

  it("rejects an unsafe replacement before writing", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));

    await expect(
      replaceInvalidRequisites(
        updatedAt,
        validPublishedRequisites,
        { siteSetting: { updateMany } },
      ),
    ).rejects.toThrow(TypeError);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("maps a stale malformed replacement token to conflict", async () => {
    const updateMany = vi.fn(async () => ({ count: 0 }));

    await expect(
      replaceInvalidRequisites(
        updatedAt,
        undefined,
        { siteSetting: { updateMany } },
      ),
    ).resolves.toEqual({ status: "conflict" });
  });

  it("does not translate non-conflict requisites failures", async () => {
    const failure = new Error("database unavailable");
    const updateMany = vi.fn(async () => {
      throw failure;
    });

    await expect(
      saveRequisites(defaultRequisitesDraft(), updatedAt, {
        siteSetting: { create: vi.fn(), updateMany },
      }),
    ).rejects.toBe(failure);
  });
});
