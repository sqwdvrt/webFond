"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
  type MutationOutcome,
} from "@/features/content-admin/mutations";
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
} from "@/features/admin-audit/content-repository";
import {
  replaceInvalidRequisites,
  saveRequisites,
} from "@/features/content-admin/repository";
import {
  parseDocumentForm,
  parseEditorialForm,
  parseProjectForm,
  parseRequisitesForm,
} from "@/features/content-admin/validation";
import { requireAdminSession } from "@/lib/admin-auth/session";

const now = () => new Date();

async function applyMutation(
  outcomePromise: Promise<MutationOutcome>,
): Promise<ContentFormState> {
  const outcome = await outcomePromise;
  if (!outcome.ok) return outcome.state;

  for (const path of outcome.effect.revalidate) {
    revalidatePath(path);
  }
  redirect(outcome.effect.redirectTo);
}

export async function createProjectAction(
  _previousState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  return applyMutation(createProjectMutation(formData, {
    requireSession: requireAdminSession,
    parse: parseProjectForm,
    create: createAuditedProject,
  }));
}

export async function updateProjectAction(
  id: string,
  _previousState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  return applyMutation(updateProjectMutation(id, formData, {
    requireSession: requireAdminSession,
    parse: parseProjectForm,
    update: updateAuditedProject,
    now,
  }));
}

export async function deleteProjectAction(
  id: string,
  slug: string,
  _previousState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  return applyMutation(deleteProjectMutation(id, slug, formData, {
    requireSession: requireAdminSession,
    remove: deleteAuditedProject,
    now,
  }));
}

export async function createNewsAction(
  _previousState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  return applyMutation(createNewsMutation(formData, {
    requireSession: requireAdminSession,
    parse: parseEditorialForm,
    create: createAuditedNews,
  }));
}

export async function updateNewsAction(
  id: string,
  _previousState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  return applyMutation(updateNewsMutation(id, formData, {
    requireSession: requireAdminSession,
    parse: parseEditorialForm,
    update: updateAuditedNews,
    now,
  }));
}

export async function deleteNewsAction(
  id: string,
  slug: string,
  _previousState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  return applyMutation(deleteNewsMutation(id, slug, formData, {
    requireSession: requireAdminSession,
    remove: deleteAuditedNews,
    now,
  }));
}

export async function createDocumentAction(
  _previousState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  return applyMutation(createDocumentMutation(formData, {
    requireSession: requireAdminSession,
    parse: parseDocumentForm,
    create: createAuditedDocument,
  }));
}

export async function updateDocumentAction(
  id: string,
  _previousState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  return applyMutation(updateDocumentMutation(id, formData, {
    requireSession: requireAdminSession,
    parse: parseDocumentForm,
    update: updateAuditedDocument,
    now,
  }));
}

export async function deleteDocumentAction(
  id: string,
  _previousState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  return applyMutation(deleteDocumentMutation(id, formData, {
    requireSession: requireAdminSession,
    remove: deleteAuditedDocument,
    now,
  }));
}

export async function saveRequisitesAction(
  _previousState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  return applyMutation(saveRequisitesMutation(formData, {
    requireSession: requireAdminSession,
    parse: parseRequisitesForm,
    save: saveRequisites,
    now,
  }));
}

export async function replaceInvalidRequisitesAction(
  _previousState: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  return applyMutation(replaceInvalidRequisitesMutation(formData, {
    requireSession: requireAdminSession,
    replace: replaceInvalidRequisites,
    now,
  }));
}
