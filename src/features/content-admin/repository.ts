import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

import type { DocumentInput, EditorialInput, ProjectInput, RequisitesInput } from "./types";
import {
  defaultRequisitesDraft,
  parseRequisitesSetting,
  publicationTimestamp,
} from "./validation";

const REQUISITES_KEY = "requisites";

const adminEditorialListSelect = {
  id: true,
  title: true,
  slug: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
} satisfies Prisma.ProjectSelect;

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
} satisfies Prisma.ProjectSelect;

const projectAdminDetailSelect = {
  ...adminEditorialDetailSelect,
  goalAmountKopecks: true,
  manualRaisedKopecks: true,
} satisfies Prisma.ProjectSelect;

const publicEditorialListSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  imageUrl: true,
  publishedAt: true,
} satisfies Prisma.ProjectSelect;

const publicEditorialDetailSelect = {
  ...publicEditorialListSelect,
  content: true,
} satisfies Prisma.ProjectSelect;

const adminDocumentListSelect = {
  id: true,
  title: true,
  category: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
} satisfies Prisma.DocumentSelect;

const adminDocumentDetailSelect = {
  id: true,
  title: true,
  category: true,
  fileUrl: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
} satisfies Prisma.DocumentSelect;

const publicDocumentSelect = {
  id: true,
  title: true,
  category: true,
  fileUrl: true,
  publishedAt: true,
} satisfies Prisma.DocumentSelect;

const editorialMutationSelect = {
  id: true,
  slug: true,
  status: true,
  publishedAt: true,
} satisfies Prisma.ProjectSelect;

const editorialCurrentSelect = {
  id: true,
  slug: true,
  status: true,
  publishedAt: true,
} satisfies Prisma.ProjectSelect;

const documentMutationSelect = {
  id: true,
  status: true,
  publishedAt: true,
} satisfies Prisma.DocumentSelect;

const documentCurrentSelect = {
  id: true,
  status: true,
  publishedAt: true,
} satisfies Prisma.DocumentSelect;

const adminOrder = [
  { updatedAt: "desc" },
  { id: "desc" },
] satisfies Prisma.ProjectOrderByWithRelationInput[];

const publicOrder = [
  { publishedAt: "desc" },
  { id: "desc" },
] satisfies Prisma.ProjectOrderByWithRelationInput[];

export type AdminEditorialListRow = Prisma.ProjectGetPayload<{
  select: typeof adminEditorialListSelect;
}>;
export type AdminEditorialRow = Prisma.ProjectGetPayload<{
  select: typeof adminEditorialDetailSelect;
}>;
export type AdminProjectRow = Prisma.ProjectGetPayload<{
  select: typeof projectAdminDetailSelect;
}>;
export type PublicEditorialListRow = Prisma.ProjectGetPayload<{
  select: typeof publicEditorialListSelect;
}>;
export type PublicEditorialDetailRow = Prisma.ProjectGetPayload<{
  select: typeof publicEditorialDetailSelect;
}>;
export type AdminDocumentListRow = Prisma.DocumentGetPayload<{
  select: typeof adminDocumentListSelect;
}>;
export type AdminDocumentRow = Prisma.DocumentGetPayload<{
  select: typeof adminDocumentDetailSelect;
}>;
export type PublicDocumentRow = Prisma.DocumentGetPayload<{
  select: typeof publicDocumentSelect;
}>;

type AdminEditorialDelegate = {
  findMany(args: {
    select: typeof adminEditorialListSelect;
    orderBy: typeof adminOrder;
  }): Promise<AdminEditorialListRow[]>;
  findUnique(args: {
    where: { id: string };
    select: typeof adminEditorialDetailSelect;
  }): Promise<AdminEditorialRow | null>;
};

type PublicEditorialDelegate = {
  findMany(args: {
    where: { status: "PUBLISHED" };
    select: typeof publicEditorialListSelect;
    orderBy: typeof publicOrder;
  }): Promise<PublicEditorialListRow[]>;
  findFirst(args: {
    where: { slug: string; status: "PUBLISHED" };
    select: typeof publicEditorialDetailSelect;
  }): Promise<PublicEditorialDetailRow | null>;
};

type AdminDocumentDelegate = {
  findMany(args: {
    select: typeof adminDocumentListSelect;
    orderBy: typeof adminOrder;
  }): Promise<AdminDocumentListRow[]>;
  findUnique(args: {
    where: { id: string };
    select: typeof adminDocumentDetailSelect;
  }): Promise<AdminDocumentRow | null>;
};

type PublicDocumentDelegate = {
  findMany(args: {
    where: { status: "PUBLISHED" };
    select: typeof publicDocumentSelect;
    orderBy: typeof publicOrder;
  }): Promise<PublicDocumentRow[]>;
};

type EditorialMutationRow = Prisma.ProjectGetPayload<{
  select: typeof editorialMutationSelect;
}>;

type EditorialCurrentRow = Prisma.ProjectGetPayload<{
  select: typeof editorialCurrentSelect;
}>;

type DocumentMutationRow = Prisma.DocumentGetPayload<{
  select: typeof documentMutationSelect;
}>;

type DocumentCurrentRow = Prisma.DocumentGetPayload<{
  select: typeof documentCurrentSelect;
}>;

type AdminProjectDelegate = {
  findUnique(args: {
    where: { id: string };
    select: typeof projectAdminDetailSelect;
  }): Promise<AdminProjectRow | null>;
};

type EditorialCreateDelegate = {
  create(args: {
    data: EditorialInput & { publishedAt: Date | null };
    select: typeof editorialMutationSelect;
  }): Promise<EditorialMutationRow>;
};

type ProjectCreateDelegate = {
  create(args: {
    data: ProjectInput & { publishedAt: Date | null };
    select: typeof editorialMutationSelect;
  }): Promise<EditorialMutationRow>;
};

type DocumentCreateDelegate = {
  create(args: {
    data: DocumentInput & { publishedAt: Date | null };
    select: typeof documentMutationSelect;
  }): Promise<DocumentMutationRow>;
};

type ProjectUpdateDelegate = {
  findUnique(args: {
    where: { id: string };
    select: typeof editorialCurrentSelect;
  }): Promise<EditorialCurrentRow | null>;
  updateMany(args: {
    where: { id: string; updatedAt: Date };
    data: ProjectInput & { publishedAt: Date | null };
  }): Promise<{ count: number }>;
};

type EditorialUpdateDelegate = {
  findUnique(args: {
    where: { id: string };
    select: typeof editorialCurrentSelect;
  }): Promise<EditorialCurrentRow | null>;
  updateMany(args: {
    where: { id: string; updatedAt: Date };
    data: EditorialInput & { publishedAt: Date | null };
  }): Promise<{ count: number }>;
};

type DocumentUpdateDelegate = {
  findUnique(args: {
    where: { id: string };
    select: typeof documentCurrentSelect;
  }): Promise<DocumentCurrentRow | null>;
  updateMany(args: {
    where: { id: string; updatedAt: Date };
    data: DocumentInput & { publishedAt: Date | null };
  }): Promise<{ count: number }>;
};

type DeleteDelegate = {
  deleteMany(args: {
    where: {
      id: string;
      updatedAt: Date;
      status: "DRAFT";
      publishedAt: null;
    };
  }): Promise<{ count: number }>;
};

type AdminRequisitesClient = {
  siteSetting: {
    findUnique(args: {
      where: { key: typeof REQUISITES_KEY };
      select: { value: true; updatedAt: true };
    }): Promise<{ value: Prisma.JsonValue; updatedAt: Date } | null>;
  };
};

type PublicRequisitesClient = {
  siteSetting: {
    findUnique(args: {
      where: { key: typeof REQUISITES_KEY };
      select: { value: true };
    }): Promise<{ value: Prisma.JsonValue } | null>;
  };
};

type RequisitesMutationClient = {
  siteSetting: {
    create(args: {
      data: { key: typeof REQUISITES_KEY; value: Prisma.InputJsonValue };
      select: { updatedAt: true };
    }): Promise<{ updatedAt: Date }>;
    updateMany(args: {
      where: { key: typeof REQUISITES_KEY; updatedAt: Date };
      data: { value: Prisma.InputJsonValue };
    }): Promise<{ count: number }>;
  };
};

type RequisitesReplacementClient = {
  siteSetting: Pick<RequisitesMutationClient["siteSetting"], "updateMany">;
};

export type AdminRequisitesResult =
  | { status: "ok"; value: RequisitesInput; updatedAt: Date }
  | { status: "missing"; value: RequisitesInput; updatedAt: null }
  | { status: "invalid"; updatedAt: Date };

export type PublishedRequisitesResult =
  | { status: "published"; value: RequisitesInput }
  | { status: "fallback"; value: RequisitesInput };

export type EditorialMutationSuccess = {
  status: "ok";
  id: string;
  previousSlug: string | null;
  slug: string;
  wasPublished: boolean;
  isPublished: boolean;
  publishedAt: Date | null;
};

export type DocumentMutationSuccess = {
  status: "ok";
  id: string;
  wasPublished: boolean;
  isPublished: boolean;
  publishedAt: Date | null;
};

export type CreateEditorialResult =
  | EditorialMutationSuccess
  | { status: "duplicate" };

export type UpdateEditorialResult =
  | EditorialMutationSuccess
  | { status: "missing" | "conflict" | "duplicate" };

export type UpdateDocumentResult =
  | DocumentMutationSuccess
  | { status: "missing" | "conflict" };

export type DeleteContentResult =
  | { status: "ok"; id: string }
  | { status: "forbidden" };

export type SaveRequisitesResult =
  | { status: "ok"; updatedAt?: Date }
  | { status: "conflict" };

function isPrismaP2002(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function requisitesJsonValue(input: RequisitesInput) {
  return {
    version: input.version,
    status: input.status,
    fullName: input.fullName,
    shortName: input.shortName,
    ogrn: input.ogrn,
    inn: input.inn,
    kpp: input.kpp,
    address: input.address,
    email: input.email,
    bankName: input.bankName,
    recipientName: input.recipientName,
    checkingAccount: input.checkingAccount,
    correspondentAccount: input.correspondentAccount,
    bik: input.bik,
  } satisfies Prisma.JsonObject;
}

function editorialSuccess(
  row: EditorialMutationRow,
  previousSlug: string | null,
  wasPublished: boolean,
): EditorialMutationSuccess {
  return {
    status: "ok",
    id: row.id,
    previousSlug,
    slug: row.slug,
    wasPublished,
    isPublished: row.status === "PUBLISHED",
    publishedAt: row.publishedAt,
  };
}

function documentSuccess(
  row: DocumentMutationRow,
  wasPublished: boolean,
): DocumentMutationSuccess {
  return {
    status: "ok",
    id: row.id,
    wasPublished,
    isPublished: row.status === "PUBLISHED",
    publishedAt: row.publishedAt,
  };
}

export function listAdminProjects(
  client: { project: Pick<AdminEditorialDelegate, "findMany"> } = prisma,
) {
  return client.project.findMany({
    select: adminEditorialListSelect,
    orderBy: adminOrder,
  });
}

export function getAdminProject(
  id: string,
  client: { project: AdminProjectDelegate } = prisma,
) {
  return client.project.findUnique({
    where: { id },
    select: projectAdminDetailSelect,
  });
}

export function listPublishedProjects(
  client: { project: Pick<PublicEditorialDelegate, "findMany"> } = prisma,
) {
  return client.project.findMany({
    where: { status: "PUBLISHED" },
    select: publicEditorialListSelect,
    orderBy: publicOrder,
  });
}

export function getPublishedProject(
  slug: string,
  client: { project: Pick<PublicEditorialDelegate, "findFirst"> } = prisma,
) {
  return client.project.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: publicEditorialDetailSelect,
  });
}

export function listAdminNews(
  client: { newsPost: Pick<AdminEditorialDelegate, "findMany"> } = prisma,
) {
  return client.newsPost.findMany({
    select: adminEditorialListSelect,
    orderBy: adminOrder,
  });
}

export function getAdminNews(
  id: string,
  client: { newsPost: Pick<AdminEditorialDelegate, "findUnique"> } = prisma,
) {
  return client.newsPost.findUnique({
    where: { id },
    select: adminEditorialDetailSelect,
  });
}

export function listPublishedNews(
  client: { newsPost: Pick<PublicEditorialDelegate, "findMany"> } = prisma,
) {
  return client.newsPost.findMany({
    where: { status: "PUBLISHED" },
    select: publicEditorialListSelect,
    orderBy: publicOrder,
  });
}

export function getPublishedNewsPost(
  slug: string,
  client: { newsPost: Pick<PublicEditorialDelegate, "findFirst"> } = prisma,
) {
  return client.newsPost.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: publicEditorialDetailSelect,
  });
}

export function listAdminDocuments(
  client: { document: Pick<AdminDocumentDelegate, "findMany"> } = prisma,
) {
  return client.document.findMany({
    select: adminDocumentListSelect,
    orderBy: adminOrder,
  });
}

export function getAdminDocument(
  id: string,
  client: { document: Pick<AdminDocumentDelegate, "findUnique"> } = prisma,
) {
  return client.document.findUnique({
    where: { id },
    select: adminDocumentDetailSelect,
  });
}

export function listPublishedDocuments(
  client: { document: Pick<PublicDocumentDelegate, "findMany"> } = prisma,
) {
  return client.document.findMany({
    where: { status: "PUBLISHED" },
    select: publicDocumentSelect,
    orderBy: publicOrder,
  });
}

export async function getAdminRequisites(
  client: AdminRequisitesClient = prisma,
): Promise<AdminRequisitesResult> {
  const setting = await client.siteSetting.findUnique({
    where: { key: REQUISITES_KEY },
    select: { value: true, updatedAt: true },
  });

  if (!setting) {
    return {
      status: "missing",
      value: defaultRequisitesDraft(),
      updatedAt: null,
    };
  }

  const parsed = parseRequisitesSetting(setting.value);
  if (!parsed.ok) return { status: "invalid", updatedAt: setting.updatedAt };

  return { status: "ok", value: parsed.value, updatedAt: setting.updatedAt };
}

export async function getPublishedRequisites(
  client: PublicRequisitesClient = prisma,
): Promise<PublishedRequisitesResult> {
  const setting = await client.siteSetting.findUnique({
    where: { key: REQUISITES_KEY },
    select: { value: true },
  });
  const parsed = setting ? parseRequisitesSetting(setting.value) : null;

  if (parsed?.ok && parsed.value.status === "PUBLISHED") {
    return { status: "published", value: parsed.value };
  }

  return { status: "fallback", value: defaultRequisitesDraft() };
}

export async function createProject(
  input: ProjectInput,
  client: { project: ProjectCreateDelegate } = prisma,
): Promise<CreateEditorialResult> {
  try {
    const row = await client.project.create({
      data: {
        ...input,
        publishedAt: publicationTimestamp(input.status, null, new Date()),
      },
      select: editorialMutationSelect,
    });
    return editorialSuccess(row, null, false);
  } catch (error) {
    if (isPrismaP2002(error)) return { status: "duplicate" };
    throw error;
  }
}

export async function createNews(
  input: EditorialInput,
  client: { newsPost: EditorialCreateDelegate } = prisma,
): Promise<CreateEditorialResult> {
  try {
    const row = await client.newsPost.create({
      data: {
        ...input,
        publishedAt: publicationTimestamp(input.status, null, new Date()),
      },
      select: editorialMutationSelect,
    });
    return editorialSuccess(row, null, false);
  } catch (error) {
    if (isPrismaP2002(error)) return { status: "duplicate" };
    throw error;
  }
}

export async function createDocument(
  input: DocumentInput,
  client: { document: DocumentCreateDelegate } = prisma,
): Promise<DocumentMutationSuccess> {
  const row = await client.document.create({
    data: {
      ...input,
      publishedAt: publicationTimestamp(input.status, null, new Date()),
    },
    select: documentMutationSelect,
  });
  return documentSuccess(row, false);
}

export async function updateProject(
  id: string,
  updatedAt: Date,
  input: ProjectInput,
  client: { project: ProjectUpdateDelegate } = prisma,
): Promise<UpdateEditorialResult> {
  const current = await client.project.findUnique({
    where: { id },
    select: editorialCurrentSelect,
  });
  if (!current) return { status: "missing" };

  const nextPublishedAt = publicationTimestamp(
    input.status,
    current.publishedAt,
    new Date(),
  );

  try {
    const updated = await client.project.updateMany({
      where: { id, updatedAt },
      data: { ...input, publishedAt: nextPublishedAt },
    });
    if (updated.count === 0) return { status: "conflict" };

    return editorialSuccess(
      { id, slug: input.slug, status: input.status, publishedAt: nextPublishedAt },
      current.slug,
      current.status === "PUBLISHED",
    );
  } catch (error) {
    if (isPrismaP2002(error)) return { status: "duplicate" };
    throw error;
  }
}

export async function updateNews(
  id: string,
  updatedAt: Date,
  input: EditorialInput,
  client: { newsPost: EditorialUpdateDelegate } = prisma,
): Promise<UpdateEditorialResult> {
  const current = await client.newsPost.findUnique({
    where: { id },
    select: editorialCurrentSelect,
  });
  if (!current) return { status: "missing" };

  const nextPublishedAt = publicationTimestamp(
    input.status,
    current.publishedAt,
    new Date(),
  );

  try {
    const updated = await client.newsPost.updateMany({
      where: { id, updatedAt },
      data: { ...input, publishedAt: nextPublishedAt },
    });
    if (updated.count === 0) return { status: "conflict" };

    return editorialSuccess(
      { id, slug: input.slug, status: input.status, publishedAt: nextPublishedAt },
      current.slug,
      current.status === "PUBLISHED",
    );
  } catch (error) {
    if (isPrismaP2002(error)) return { status: "duplicate" };
    throw error;
  }
}

export async function updateDocument(
  id: string,
  updatedAt: Date,
  input: DocumentInput,
  client: { document: DocumentUpdateDelegate } = prisma,
): Promise<UpdateDocumentResult> {
  const current = await client.document.findUnique({
    where: { id },
    select: documentCurrentSelect,
  });
  if (!current) return { status: "missing" };

  const nextPublishedAt = publicationTimestamp(
    input.status,
    current.publishedAt,
    new Date(),
  );
  const updated = await client.document.updateMany({
    where: { id, updatedAt },
    data: { ...input, publishedAt: nextPublishedAt },
  });
  if (updated.count === 0) return { status: "conflict" };

  return documentSuccess(
    { id, status: input.status, publishedAt: nextPublishedAt },
    current.status === "PUBLISHED",
  );
}

export async function deleteProject(
  id: string,
  updatedAt: Date,
  client: { project: DeleteDelegate } = prisma,
): Promise<DeleteContentResult> {
  const deleted = await client.project.deleteMany({
    where: { id, updatedAt, status: "DRAFT", publishedAt: null },
  });
  return deleted.count === 1
    ? { status: "ok", id }
    : { status: "forbidden" };
}

export async function deleteNews(
  id: string,
  updatedAt: Date,
  client: { newsPost: DeleteDelegate } = prisma,
): Promise<DeleteContentResult> {
  const deleted = await client.newsPost.deleteMany({
    where: { id, updatedAt, status: "DRAFT", publishedAt: null },
  });
  return deleted.count === 1
    ? { status: "ok", id }
    : { status: "forbidden" };
}

export async function deleteDocument(
  id: string,
  updatedAt: Date,
  client: { document: DeleteDelegate } = prisma,
): Promise<DeleteContentResult> {
  const deleted = await client.document.deleteMany({
    where: { id, updatedAt, status: "DRAFT", publishedAt: null },
  });
  return deleted.count === 1
    ? { status: "ok", id }
    : { status: "forbidden" };
}

export async function saveRequisites(
  input: RequisitesInput,
  updatedAt: Date | null,
  client: RequisitesMutationClient = prisma,
): Promise<SaveRequisitesResult> {
  const value = requisitesJsonValue(input);

  if (!updatedAt) {
    try {
      const created = await client.siteSetting.create({
        data: { key: REQUISITES_KEY, value },
        select: { updatedAt: true },
      });
      return { status: "ok", updatedAt: created.updatedAt };
    } catch (error) {
      if (isPrismaP2002(error)) return { status: "conflict" };
      throw error;
    }
  }

  const saved = await client.siteSetting.updateMany({
    where: { key: REQUISITES_KEY, updatedAt },
    data: { value },
  });
  return saved.count === 1 ? { status: "ok" } : { status: "conflict" };
}

export async function replaceInvalidRequisites(
  updatedAt: Date,
  replacement: RequisitesInput = defaultRequisitesDraft(),
  client: RequisitesReplacementClient = prisma,
): Promise<SaveRequisitesResult> {
  const parsed = parseRequisitesSetting(requisitesJsonValue(replacement));
  if (!parsed.ok || parsed.value.status !== "DRAFT") {
    throw new TypeError("Requisites replacement must be a valid draft");
  }

  const saved = await client.siteSetting.updateMany({
    where: { key: REQUISITES_KEY, updatedAt },
    data: { value: requisitesJsonValue(parsed.value) },
  });
  return saved.count === 1 ? { status: "ok" } : { status: "conflict" };
}
