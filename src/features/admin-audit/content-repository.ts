import { prisma } from "@/lib/db";

import {
  createDocument,
  createNews,
  createProject,
  deleteDocument,
  deleteNews,
  deleteProject,
  updateDocument,
  updateNews,
  updateProject,
} from "../content-admin/repository";
import type {
  DocumentInput,
  EditorialInput,
  ProjectInput,
} from "../content-admin/types";
import {
  contentCreatedAuditEvents,
  contentDeletedAuditEvents,
  contentUpdatedAuditEvents,
  type ContentAuditEvent,
} from "./events";

type ProjectCreateClient = NonNullable<Parameters<typeof createProject>[1]>;
type NewsCreateClient = NonNullable<Parameters<typeof createNews>[1]>;
type DocumentCreateClient = NonNullable<Parameters<typeof createDocument>[1]>;
type ProjectUpdateClient = NonNullable<Parameters<typeof updateProject>[3]>;
type NewsUpdateClient = NonNullable<Parameters<typeof updateNews>[3]>;
type DocumentUpdateClient = NonNullable<Parameters<typeof updateDocument>[3]>;
type ProjectDeleteClient = NonNullable<Parameters<typeof deleteProject>[2]>;
type NewsDeleteClient = NonNullable<Parameters<typeof deleteNews>[2]>;
type DocumentDeleteClient = NonNullable<Parameters<typeof deleteDocument>[2]>;

type ContentAuditTransaction = ProjectCreateClient &
  NewsCreateClient &
  DocumentCreateClient &
  ProjectUpdateClient &
  NewsUpdateClient &
  DocumentUpdateClient &
  ProjectDeleteClient &
  NewsDeleteClient &
  DocumentDeleteClient & {
    adminAuditEvent: {
      createMany(args: { data: ContentAuditEvent[] }): Promise<unknown>;
    };
  };

type ContentAuditClient = {
  $transaction<T>(
    callback: (transaction: ContentAuditTransaction) => Promise<T>,
  ): Promise<T>;
};

const defaultClient = prisma as unknown as ContentAuditClient;

export function createAuditedProject(
  input: ProjectInput,
  client: ContentAuditClient = defaultClient,
) {
  return client.$transaction(async (transaction) => {
    const result = await createProject(input, { project: transaction.project });
    if (result.status !== "ok") return result;

    await transaction.adminAuditEvent.createMany({
      data: contentCreatedAuditEvents({
        entityType: "PROJECT",
        id: result.id,
        status: result.publicationStatus,
      }),
    });
    return result;
  });
}
export function createAuditedNews(
  input: EditorialInput,
  client: ContentAuditClient = defaultClient,
) {
  return client.$transaction(async (transaction) => {
    const result = await createNews(input, { newsPost: transaction.newsPost });
    if (result.status !== "ok") return result;

    await transaction.adminAuditEvent.createMany({
      data: contentCreatedAuditEvents({
        entityType: "NEWS_POST",
        id: result.id,
        status: result.publicationStatus,
      }),
    });
    return result;
  });
}

export function createAuditedDocument(
  input: DocumentInput,
  client: ContentAuditClient = defaultClient,
) {
  return client.$transaction(async (transaction) => {
    const result = await createDocument(input, { document: transaction.document });

    await transaction.adminAuditEvent.createMany({
      data: contentCreatedAuditEvents({
        entityType: "DOCUMENT",
        id: result.id,
        status: result.publicationStatus,
      }),
    });
    return result;
  });
}

export function updateAuditedProject(
  id: string,
  updatedAt: Date,
  input: ProjectInput,
  client: ContentAuditClient = defaultClient,
) {
  return client.$transaction(async (transaction) => {
    const result = await updateProject(id, updatedAt, input, {
      project: transaction.project,
    });
    if (result.status !== "ok") return result;
    if (result.previousStatus === null) {
      throw new Error("Updated project is missing its previous status");
    }

    const events = contentUpdatedAuditEvents({
      entityType: "PROJECT",
      id: result.id,
      previousStatus: result.previousStatus,
      status: result.publicationStatus,
    });
    if (events.length > 0) {
      await transaction.adminAuditEvent.createMany({ data: events });
    }
    return result;
  });
}

export function updateAuditedNews(
  id: string,
  updatedAt: Date,
  input: EditorialInput,
  client: ContentAuditClient = defaultClient,
) {
  return client.$transaction(async (transaction) => {
    const result = await updateNews(id, updatedAt, input, {
      newsPost: transaction.newsPost,
    });
    if (result.status !== "ok") return result;
    if (result.previousStatus === null) {
      throw new Error("Updated news post is missing its previous status");
    }

    const events = contentUpdatedAuditEvents({
      entityType: "NEWS_POST",
      id: result.id,
      previousStatus: result.previousStatus,
      status: result.publicationStatus,
    });
    if (events.length > 0) {
      await transaction.adminAuditEvent.createMany({ data: events });
    }
    return result;
  });
}

export function updateAuditedDocument(
  id: string,
  updatedAt: Date,
  input: DocumentInput,
  client: ContentAuditClient = defaultClient,
) {
  return client.$transaction(async (transaction) => {
    const result = await updateDocument(id, updatedAt, input, {
      document: transaction.document,
    });
    if (result.status !== "ok") return result;
    if (result.previousStatus === null) {
      throw new Error("Updated document is missing its previous status");
    }

    const events = contentUpdatedAuditEvents({
      entityType: "DOCUMENT",
      id: result.id,
      previousStatus: result.previousStatus,
      status: result.publicationStatus,
    });
    if (events.length > 0) {
      await transaction.adminAuditEvent.createMany({ data: events });
    }
    return result;
  });
}

export function deleteAuditedProject(
  id: string,
  updatedAt: Date,
  client: ContentAuditClient = defaultClient,
) {
  return client.$transaction(async (transaction) => {
    const result = await deleteProject(id, updatedAt, {
      project: transaction.project,
    });
    if (result.status !== "ok") return result;

    await transaction.adminAuditEvent.createMany({
      data: contentDeletedAuditEvents({ entityType: "PROJECT", id: result.id }),
    });
    return result;
  });
}

export function deleteAuditedNews(
  id: string,
  updatedAt: Date,
  client: ContentAuditClient = defaultClient,
) {
  return client.$transaction(async (transaction) => {
    const result = await deleteNews(id, updatedAt, {
      newsPost: transaction.newsPost,
    });
    if (result.status !== "ok") return result;

    await transaction.adminAuditEvent.createMany({
      data: contentDeletedAuditEvents({ entityType: "NEWS_POST", id: result.id }),
    });
    return result;
  });
}

export function deleteAuditedDocument(
  id: string,
  updatedAt: Date,
  client: ContentAuditClient = defaultClient,
) {
  return client.$transaction(async (transaction) => {
    const result = await deleteDocument(id, updatedAt, {
      document: transaction.document,
    });
    if (result.status !== "ok") return result;

    await transaction.adminAuditEvent.createMany({
      data: contentDeletedAuditEvents({ entityType: "DOCUMENT", id: result.id }),
    });
    return result;
  });
}
