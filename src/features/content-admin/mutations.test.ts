import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CreateEditorialResult,
  DeleteContentResult,
  DocumentMutationSuccess,
  SaveRequisitesResult,
  UpdateDocumentResult,
  UpdateEditorialResult,
} from "./repository";
import type {
  DocumentInput,
  EditorialInput,
  RequisitesInput,
  ValidationResult,
} from "./types";
import {
  createDocumentMutation,
  createNewsMutation,
  createProjectMutation,
  deleteDocumentMutation,
  deleteNewsMutation,
  deleteProjectMutation,
  replaceInvalidRequisitesMutation,
  saveRequisitesMutation,
  updateDocumentMutation,
  updateNewsMutation,
  updateProjectMutation,
  type ContentFormState,
} from "./mutations";

const now = new Date("2026-08-23T12:00:00.000Z");
const updatedAt = new Date("2026-08-23T10:00:00.000Z");

const editorialInput: EditorialInput = {
  title: "Помощь рядом",
  slug: "pomoshch-ryadom",
  summary: null,
  content: null,
  imageUrl: null,
  status: "DRAFT",
};

const documentInput: DocumentInput = {
  title: "Устав фонда",
  category: "Учредительные документы",
  fileUrl: "/documents/charter.pdf",
  status: "DRAFT",
};

const requisitesInput: RequisitesInput = {
  version: 1,
  status: "DRAFT",
  fullName: "Благотворительный фонд БЫТЬ ДОБРУ",
  shortName: "БФ БЫТЬ ДОБРУ",
  ogrn: "1234567890123",
  inn: "1234567890",
  kpp: "123456789",
  address: "г. Москва, ул. Добра, д. 1",
  email: "help@example.org",
  bankName: "",
  recipientName: "",
  checkingAccount: "",
  correspondentAccount: "",
  bik: "",
};

function formWithToken(token = updatedAt.toISOString()) {
  const data = new FormData();
  data.set("updatedAt", token);
  return data;
}

function ok<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

function invalid<T>(): ValidationResult<T> {
  return {
    ok: false,
    errors: { title: "Проверьте заголовок" } as never,
    values: { title: "x" } as never,
  };
}

function editorialSuccess(
  overrides: Partial<Extract<CreateEditorialResult, { status: "ok" }>> = {},
): Extract<CreateEditorialResult, { status: "ok" }> {
  return {
    status: "ok",
    id: "entry-1",
    previousSlug: null,
    slug: editorialInput.slug,
    wasPublished: false,
    isPublished: false,
    publishedAt: null,
    ...overrides,
  };
}

function documentSuccess(
  overrides: Partial<DocumentMutationSuccess> = {},
): DocumentMutationSuccess {
  return {
    status: "ok",
    id: "document-1",
    wasPublished: false,
    isPublished: false,
    publishedAt: null,
    ...overrides,
  };
}

function expectEffect(
  result: Awaited<ReturnType<typeof createProjectMutation>>,
  revalidate: string[],
  redirectTo: string,
) {
  expect(result).toEqual({
    ok: true,
    effect: { revalidate, redirectTo },
  });
}

describe("content mutation authorization order", () => {
  let events: string[];
  let requireSession: () => Promise<void>;
  let clock: () => Date;

  beforeEach(() => {
    events = [];
    requireSession = vi.fn(async () => {
      events.push("session");
    });
    clock = vi.fn(() => {
      events.push("clock");
      return now;
    });
  });

  it.each([
    ["project create", () => createProjectMutation(new FormData(), {
      requireSession,
      parse: vi.fn(() => { events.push("parse"); return ok(editorialInput); }),
      create: vi.fn(async () => { events.push("repository"); return editorialSuccess(); }),
    })],
    ["news create", () => createNewsMutation(new FormData(), {
      requireSession,
      parse: vi.fn(() => { events.push("parse"); return ok(editorialInput); }),
      create: vi.fn(async () => { events.push("repository"); return editorialSuccess(); }),
    })],
    ["document create", () => createDocumentMutation(new FormData(), {
      requireSession,
      parse: vi.fn(() => { events.push("parse"); return ok(documentInput); }),
      create: vi.fn(async () => { events.push("repository"); return documentSuccess(); }),
    })],
    ["project update", () => updateProjectMutation("entry-1", formWithToken(), {
      requireSession,
      parse: vi.fn(() => { events.push("parse"); return ok(editorialInput); }),
      update: vi.fn(async () => { events.push("repository"); return editorialSuccess({ previousSlug: editorialInput.slug }); }),
      now: clock,
    })],
    ["news update", () => updateNewsMutation("entry-1", formWithToken(), {
      requireSession,
      parse: vi.fn(() => { events.push("parse"); return ok(editorialInput); }),
      update: vi.fn(async () => { events.push("repository"); return editorialSuccess({ previousSlug: editorialInput.slug }); }),
      now: clock,
    })],
    ["document update", () => updateDocumentMutation("document-1", formWithToken(), {
      requireSession,
      parse: vi.fn(() => { events.push("parse"); return ok(documentInput); }),
      update: vi.fn(async () => { events.push("repository"); return documentSuccess(); }),
      now: clock,
    })],
    ["project delete", () => deleteProjectMutation("entry-1", editorialInput.slug, formWithToken(), {
      requireSession,
      remove: vi.fn(async () => { events.push("repository"); return { status: "ok" as const, id: "entry-1" }; }),
      now: clock,
    })],
    ["news delete", () => deleteNewsMutation("entry-1", editorialInput.slug, formWithToken(), {
      requireSession,
      remove: vi.fn(async () => { events.push("repository"); return { status: "ok" as const, id: "entry-1" }; }),
      now: clock,
    })],
    ["document delete", () => deleteDocumentMutation("document-1", formWithToken(), {
      requireSession,
      remove: vi.fn(async () => { events.push("repository"); return { status: "ok" as const, id: "document-1" }; }),
      now: clock,
    })],
    ["requisites save", () => saveRequisitesMutation(formWithToken(), {
      requireSession,
      parse: vi.fn(() => { events.push("parse"); return ok(requisitesInput); }),
      save: vi.fn(async () => { events.push("repository"); return { status: "ok" as const }; }),
      now: clock,
    })],
    ["invalid requisites replacement", () => replaceInvalidRequisitesMutation(formWithToken(), {
      requireSession,
      replace: vi.fn(async () => { events.push("repository"); return { status: "ok" as const }; }),
      now: clock,
    })],
  ])("checks the session before parsing or repository access for %s", async (_name, run) => {
    await run();

    expect(events[0]).toBe("session");
    expect(events.indexOf("session")).toBeLessThan(events.indexOf("repository"));
    if (events.includes("parse")) {
      expect(events.indexOf("session")).toBeLessThan(events.indexOf("parse"));
    }
  });

  it("does not parse, read the clock or access the repository when auth rejects", async () => {
    const denied = new Error("redirected");
    const parse = vi.fn(() => ok(editorialInput));
    const update = vi.fn<() => Promise<UpdateEditorialResult>>();
    requireSession = vi.fn(async () => {
      throw denied;
    });

    await expect(updateProjectMutation("entry-1", formWithToken(), {
      requireSession,
      parse,
      update,
      now: clock,
    })).rejects.toBe(denied);
    expect(parse).not.toHaveBeenCalled();
    expect(clock).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("neutral mutation failures", () => {
  const requireSession = vi.fn(async () => undefined);

  it("returns validation fields without calling the repository", async () => {
    const create = vi.fn<() => Promise<CreateEditorialResult>>();

    const result = await createProjectMutation(new FormData(), {
      requireSession,
      parse: () => invalid<EditorialInput>(),
      create,
    });

    expect(result).toEqual({
      ok: false,
      state: {
        status: "error",
        message: "Проверьте заполнение формы",
        errors: { title: "Проверьте заголовок" },
        values: { title: "x" },
      },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    ["duplicate", "Такой адрес уже используется"],
    ["conflict", "Данные изменились. Обновите страницу и повторите действие"],
    ["missing", "Данные изменились. Обновите страницу и повторите действие"],
  ] as const)("maps %s to a neutral form error without an effect", async (status, message) => {
    const repositoryResult = { status } as UpdateEditorialResult;
    const result = await updateProjectMutation("entry-1", formWithToken(), {
      requireSession,
      parse: () => ok(editorialInput),
      update: vi.fn(async () => repositoryResult),
      now: () => now,
    });

    expect(result).toEqual({
      ok: false,
      state: { status: "error", message },
    });
    expect(result).not.toHaveProperty("effect");
  });

  it("maps a forbidden delete to a neutral form error without an effect", async () => {
    const result = await deleteDocumentMutation("document-1", formWithToken(), {
      requireSession,
      remove: vi.fn(async (): Promise<DeleteContentResult> => ({ status: "forbidden" })),
      now: () => now,
    });

    expect(result).toEqual({
      ok: false,
      state: {
        status: "error",
        message: "Удаление недоступно. Обновите страницу и повторите действие",
      },
    });
  });

  it.each(["not-a-date", "2026-08-23T13:00:00.000Z"])(
    "rejects an invalid optimistic-lock token %s before repository access",
    async (token) => {
      const update = vi.fn<() => Promise<UpdateDocumentResult>>();
      const result = await updateDocumentMutation("document-1", formWithToken(token), {
        requireSession,
        parse: () => ok(documentInput),
        update,
        now: () => now,
      });

      expect(result).toMatchObject({ ok: false, state: { status: "error" } });
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("allows a missing token only when requisites have not been created", async () => {
    const data = new FormData();
    const save = vi.fn(async (): Promise<SaveRequisitesResult> => ({ status: "ok" }));

    await saveRequisitesMutation(data, {
      requireSession,
      parse: () => ok(requisitesInput),
      save,
      now: () => now,
    });

    expect(save).toHaveBeenCalledWith(requisitesInput, null);
  });
});

describe.each([
  {
    kind: "project",
    base: ["/admin/projects", "/projects"],
    detail: "/projects",
    create: createProjectMutation,
    update: updateProjectMutation,
    remove: deleteProjectMutation,
  },
  {
    kind: "news",
    base: ["/admin/news", "/news"],
    detail: "/news",
    create: createNewsMutation,
    update: updateNewsMutation,
    remove: deleteNewsMutation,
  },
])("$kind mutation effects", ({ kind, base, detail, create, update, remove }) => {
  const requireSession = vi.fn(async () => undefined);

  it("revalidates the first published detail and sitemap", async () => {
    const result = await create(new FormData(), {
      requireSession,
      parse: () => ok({ ...editorialInput, status: "PUBLISHED" }),
      create: vi.fn(async () => editorialSuccess({ isPublished: true, publishedAt: now })),
    });

    expectEffect(
      result,
      [...base, `${detail}/${editorialInput.slug}`, "/sitemap.xml"],
      `/admin/${kind === "project" ? "projects" : "news"}/entry-1?success=created`,
    );
  });

  it("revalidates the old detail and sitemap when archiving", async () => {
    const result = await update("entry-1", formWithToken(), {
      requireSession,
      parse: () => ok({ ...editorialInput, status: "ARCHIVED" }),
      update: vi.fn(async () => editorialSuccess({
        previousSlug: "old-slug",
        slug: "old-slug",
        wasPublished: true,
        publishedAt: updatedAt,
      })),
      now: () => now,
    });

    expectEffect(
      result,
      [...base, `${detail}/old-slug`, "/sitemap.xml"],
      `/admin/${kind === "project" ? "projects" : "news"}/entry-1?success=saved`,
    );
  });

  it("revalidates the new detail and sitemap on first publication", async () => {
    const result = await update("entry-1", formWithToken(), {
      requireSession,
      parse: () => ok({ ...editorialInput, status: "PUBLISHED" }),
      update: vi.fn(async () => editorialSuccess({
        previousSlug: editorialInput.slug,
        isPublished: true,
        publishedAt: now,
      })),
      now: () => now,
    });

    expectEffect(
      result,
      [...base, `${detail}/${editorialInput.slug}`, "/sitemap.xml"],
      `/admin/${kind === "project" ? "projects" : "news"}/entry-1?success=saved`,
    );
  });

  it("revalidates old and new detail paths plus sitemap for a published slug rename", async () => {
    const result = await update("entry-1", formWithToken(), {
      requireSession,
      parse: () => ok({ ...editorialInput, slug: "new-slug", status: "PUBLISHED" }),
      update: vi.fn(async () => editorialSuccess({
        previousSlug: "old-slug",
        slug: "new-slug",
        wasPublished: true,
        isPublished: true,
        publishedAt: updatedAt,
      })),
      now: () => now,
    });

    expectEffect(
      result,
      [...base, `${detail}/old-slug`, `${detail}/new-slug`, "/sitemap.xml"],
      `/admin/${kind === "project" ? "projects" : "news"}/entry-1?success=saved`,
    );
  });

  it("revalidates old and new detail paths without sitemap for a draft slug rename", async () => {
    const result = await update("entry-1", formWithToken(), {
      requireSession,
      parse: () => ok({ ...editorialInput, slug: "new-slug" }),
      update: vi.fn(async () => editorialSuccess({
        previousSlug: "old-slug",
        slug: "new-slug",
      })),
      now: () => now,
    });

    expectEffect(
      result,
      [...base, `${detail}/old-slug`, `${detail}/new-slug`],
      `/admin/${kind === "project" ? "projects" : "news"}/entry-1?success=saved`,
    );
  });

  it("deduplicates an unchanged published detail path", async () => {
    const result = await update("entry-1", formWithToken(), {
      requireSession,
      parse: () => ok({ ...editorialInput, status: "PUBLISHED" }),
      update: vi.fn(async () => editorialSuccess({
        previousSlug: editorialInput.slug,
        wasPublished: true,
        isPublished: true,
        publishedAt: updatedAt,
      })),
      now: () => now,
    });

    expectEffect(
      result,
      [...base, `${detail}/${editorialInput.slug}`],
      `/admin/${kind === "project" ? "projects" : "news"}/entry-1?success=saved`,
    );
  });

  it("revalidates the deleted slug and sitemap", async () => {
    const result = await remove("entry-1", "old-slug", formWithToken(), {
      requireSession,
      remove: vi.fn(async () => ({ status: "ok" as const, id: "entry-1" })),
      now: () => now,
    });

    expectEffect(
      result,
      [...base, `${detail}/old-slug`, "/sitemap.xml"],
      `/admin/${kind === "project" ? "projects" : "news"}?success=deleted`,
    );
  });
});

describe("document and requisites mutation effects", () => {
  const requireSession = vi.fn(async () => undefined);

  it("keeps a draft document mutation to the admin and reports collections", async () => {
    const result = await createDocumentMutation(new FormData(), {
      requireSession,
      parse: () => ok(documentInput),
      create: vi.fn(async () => documentSuccess()),
    });

    expect(result).toEqual({
      ok: true,
      effect: {
        revalidate: ["/admin/documents", "/reports"],
        redirectTo: "/admin/documents/document-1?success=created",
      },
    });
  });

  it.each([
    [false, true],
    [true, false],
  ])("revalidates the sitemap for document publication transition %s -> %s", async (wasPublished, isPublished) => {
    const result = await updateDocumentMutation("document-1", formWithToken(), {
      requireSession,
      parse: () => ok({ ...documentInput, status: isPublished ? "PUBLISHED" : "ARCHIVED" }),
      update: vi.fn(async () => documentSuccess({ wasPublished, isPublished })),
      now: () => now,
    });

    expect(result).toMatchObject({
      ok: true,
      effect: {
        revalidate: ["/admin/documents", "/reports", "/sitemap.xml"],
      },
    });
  });

  it("does not add sitemap revalidation when deleting a never-published document", async () => {
    const result = await deleteDocumentMutation("document-1", formWithToken(), {
      requireSession,
      remove: vi.fn(async () => ({ status: "ok" as const, id: "document-1" })),
      now: () => now,
    });

    expect(result).toEqual({
      ok: true,
      effect: {
        revalidate: ["/admin/documents", "/reports"],
        redirectTo: "/admin/documents?success=deleted",
      },
    });
  });

  it.each([
    ["save", saveRequisitesMutation],
    ["replace", replaceInvalidRequisitesMutation],
  ] as const)("revalidates both requisites routes after %s", async (operation, mutate) => {
    const dependencies = operation === "save"
      ? {
          requireSession,
          parse: () => ok(requisitesInput),
          save: vi.fn(async () => ({ status: "ok" as const })),
          now: () => now,
        }
      : {
          requireSession,
          replace: vi.fn(async () => ({ status: "ok" as const })),
          now: () => now,
        };
    const result = await mutate(formWithToken(), dependencies as never);

    expect(result).toEqual({
      ok: true,
      effect: {
        revalidate: ["/admin/requisites", "/requisites"],
        redirectTo: `/admin/requisites?success=${operation === "save" ? "saved" : "replaced"}`,
      },
    });
  });
});

it("exports a reusable idle form state shape", async () => {
  const state: ContentFormState = { status: "idle", message: "" };
  expect(state).toEqual({ status: "idle", message: "" });
});
