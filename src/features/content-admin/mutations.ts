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

export type ContentFormState = {
  status: "idle" | "error";
  message: string;
  errors?: Partial<Record<string, string>>;
  values?: Partial<Record<string, string | number | null>>;
};

export type MutationEffect = {
  revalidate: string[];
  redirectTo: string;
};

export type MutationOutcome =
  | { ok: false; state: ContentFormState }
  | { ok: true; effect: MutationEffect };

type RequireSession = () => Promise<unknown>;
type Clock = () => Date;

type CreateDependencies<TInput, TResult> = {
  requireSession: RequireSession;
  parse: (formData: FormData) => ValidationResult<TInput>;
  create: (input: TInput) => Promise<TResult>;
};

type UpdateDependencies<TInput, TResult> = {
  requireSession: RequireSession;
  parse: (formData: FormData) => ValidationResult<TInput>;
  update: (id: string, updatedAt: Date, input: TInput) => Promise<TResult>;
  now: Clock;
};

type DeleteDependencies = {
  requireSession: RequireSession;
  remove: (id: string, updatedAt: Date) => Promise<DeleteContentResult>;
  now: Clock;
};

type SaveRequisitesDependencies = {
  requireSession: RequireSession;
  parse: (formData: FormData) => ValidationResult<RequisitesInput>;
  save: (
    input: RequisitesInput,
    updatedAt: Date | null,
  ) => Promise<SaveRequisitesResult>;
  now: Clock;
};

type ReplaceRequisitesDependencies = {
  requireSession: RequireSession;
  replace: (updatedAt: Date) => Promise<SaveRequisitesResult>;
  now: Clock;
};

const VALIDATION_MESSAGE = "Проверьте заполнение формы";
const DUPLICATE_MESSAGE = "Такой адрес уже используется";
const CONFLICT_MESSAGE =
  "Данные изменились. Обновите страницу и повторите действие";
const FORBIDDEN_MESSAGE =
  "Удаление недоступно. Обновите страницу и повторите действие";
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function error(message: string): MutationOutcome {
  return { ok: false, state: { status: "error", message } };
}

function validationError<T>(
  result: Extract<ValidationResult<T>, { ok: false }>,
): MutationOutcome {
  return {
    ok: false,
    state: {
      status: "error",
      message: VALIDATION_MESSAGE,
      errors: result.errors,
      values: result.values,
    },
  };
}

function success(revalidate: string[], redirectTo: string): MutationOutcome {
  return {
    ok: true,
    effect: { revalidate: [...new Set(revalidate)], redirectTo },
  };
}

function readUpdatedAt(
  formData: FormData,
  now: Date,
  optional = false,
): Date | null | undefined {
  const entries = formData.getAll("updatedAt");
  if (entries.length === 0 && optional) return null;
  if (entries.length !== 1 || typeof entries[0] !== "string") return undefined;

  const value = new Date(entries[0]);
  if (!Number.isFinite(value.getTime()) || value.getTime() > now.getTime()) {
    return undefined;
  }
  return value;
}

function repositoryError(status: "duplicate" | "conflict" | "missing" | "forbidden") {
  if (status === "duplicate") return error(DUPLICATE_MESSAGE);
  if (status === "conflict" || status === "missing") {
    return error(CONFLICT_MESSAGE);
  }
  return error(FORBIDDEN_MESSAGE);
}

type EditorialSection = {
  adminPath: "/admin/projects" | "/admin/news";
  publicPath: "/projects" | "/news";
};

function editorialPaths(
  section: EditorialSection,
  result: Extract<UpdateEditorialResult, { status: "ok" }>,
) {
  const paths: string[] = [section.adminPath, section.publicPath];
  const slugChanged =
    result.previousSlug !== null && result.previousSlug !== result.slug;

  if (slugChanged && result.previousSlug) {
    paths.push(`${section.publicPath}/${result.previousSlug}`);
    paths.push(`${section.publicPath}/${result.slug}`);
  } else if (result.wasPublished || result.isPublished) {
    paths.push(`${section.publicPath}/${result.slug}`);
  }
  if (
    result.wasPublished !== result.isPublished ||
    (result.wasPublished && slugChanged)
  ) {
    paths.push("/sitemap.xml");
  }
  return paths;
}

async function createEditorialMutation(
  formData: FormData,
  dependencies: CreateDependencies<EditorialInput, CreateEditorialResult>,
  section: EditorialSection,
): Promise<MutationOutcome> {
  await dependencies.requireSession();
  const parsed = dependencies.parse(formData);
  if (!parsed.ok) return validationError(parsed);

  const result = await dependencies.create(parsed.value);
  if (result.status !== "ok") return repositoryError(result.status);

  const paths: string[] = [section.adminPath, section.publicPath];
  if (result.isPublished) {
    paths.push(`${section.publicPath}/${result.slug}`, "/sitemap.xml");
  }
  return success(
    paths,
    `${section.adminPath}/${result.id}?success=created`,
  );
}

async function updateEditorialMutation(
  id: string,
  formData: FormData,
  dependencies: UpdateDependencies<EditorialInput, UpdateEditorialResult>,
  section: EditorialSection,
): Promise<MutationOutcome> {
  await dependencies.requireSession();
  const parsed = dependencies.parse(formData);
  if (!parsed.ok) return validationError(parsed);

  const updatedAt = readUpdatedAt(formData, dependencies.now());
  if (!updatedAt) return error(CONFLICT_MESSAGE);

  const result = await dependencies.update(id, updatedAt, parsed.value);
  if (result.status !== "ok") return repositoryError(result.status);

  return success(
    editorialPaths(section, result),
    `${section.adminPath}/${result.id}?success=saved`,
  );
}

async function deleteEditorialMutation(
  id: string,
  slug: string,
  formData: FormData,
  dependencies: DeleteDependencies,
  section: EditorialSection,
): Promise<MutationOutcome> {
  await dependencies.requireSession();
  const updatedAt = readUpdatedAt(formData, dependencies.now());
  if (!updatedAt || !SAFE_SLUG.test(slug)) return error(CONFLICT_MESSAGE);

  const result = await dependencies.remove(id, updatedAt);
  if (result.status !== "ok") return repositoryError(result.status);

  return success(
    [
      section.adminPath,
      section.publicPath,
      `${section.publicPath}/${slug}`,
      "/sitemap.xml",
    ],
    `${section.adminPath}?success=deleted`,
  );
}

const projectSection = {
  adminPath: "/admin/projects",
  publicPath: "/projects",
} as const;

const newsSection = {
  adminPath: "/admin/news",
  publicPath: "/news",
} as const;

export function createProjectMutation(
  formData: FormData,
  dependencies: CreateDependencies<EditorialInput, CreateEditorialResult>,
) {
  return createEditorialMutation(formData, dependencies, projectSection);
}

export function createNewsMutation(
  formData: FormData,
  dependencies: CreateDependencies<EditorialInput, CreateEditorialResult>,
) {
  return createEditorialMutation(formData, dependencies, newsSection);
}

export async function createDocumentMutation(
  formData: FormData,
  dependencies: CreateDependencies<DocumentInput, DocumentMutationSuccess>,
): Promise<MutationOutcome> {
  await dependencies.requireSession();
  const parsed = dependencies.parse(formData);
  if (!parsed.ok) return validationError(parsed);

  const result = await dependencies.create(parsed.value);
  const paths: string[] = ["/admin/documents", "/reports"];
  if (result.isPublished) paths.push("/sitemap.xml");
  return success(paths, `/admin/documents/${result.id}?success=created`);
}

export function updateProjectMutation(
  id: string,
  formData: FormData,
  dependencies: UpdateDependencies<EditorialInput, UpdateEditorialResult>,
) {
  return updateEditorialMutation(id, formData, dependencies, projectSection);
}

export function updateNewsMutation(
  id: string,
  formData: FormData,
  dependencies: UpdateDependencies<EditorialInput, UpdateEditorialResult>,
) {
  return updateEditorialMutation(id, formData, dependencies, newsSection);
}

export async function updateDocumentMutation(
  id: string,
  formData: FormData,
  dependencies: UpdateDependencies<DocumentInput, UpdateDocumentResult>,
): Promise<MutationOutcome> {
  await dependencies.requireSession();
  const parsed = dependencies.parse(formData);
  if (!parsed.ok) return validationError(parsed);

  const updatedAt = readUpdatedAt(formData, dependencies.now());
  if (!updatedAt) return error(CONFLICT_MESSAGE);

  const result = await dependencies.update(id, updatedAt, parsed.value);
  if (result.status !== "ok") return repositoryError(result.status);

  const paths: string[] = ["/admin/documents", "/reports"];
  if (result.wasPublished !== result.isPublished) paths.push("/sitemap.xml");
  return success(paths, `/admin/documents/${result.id}?success=saved`);
}

export function deleteProjectMutation(
  id: string,
  slug: string,
  formData: FormData,
  dependencies: DeleteDependencies,
) {
  return deleteEditorialMutation(
    id,
    slug,
    formData,
    dependencies,
    projectSection,
  );
}

export function deleteNewsMutation(
  id: string,
  slug: string,
  formData: FormData,
  dependencies: DeleteDependencies,
) {
  return deleteEditorialMutation(id, slug, formData, dependencies, newsSection);
}

export async function deleteDocumentMutation(
  id: string,
  formData: FormData,
  dependencies: DeleteDependencies,
): Promise<MutationOutcome> {
  await dependencies.requireSession();
  const updatedAt = readUpdatedAt(formData, dependencies.now());
  if (!updatedAt) return error(CONFLICT_MESSAGE);

  const result = await dependencies.remove(id, updatedAt);
  if (result.status !== "ok") return repositoryError(result.status);

  return success(
    ["/admin/documents", "/reports"],
    "/admin/documents?success=deleted",
  );
}

export async function saveRequisitesMutation(
  formData: FormData,
  dependencies: SaveRequisitesDependencies,
): Promise<MutationOutcome> {
  await dependencies.requireSession();
  const parsed = dependencies.parse(formData);
  if (!parsed.ok) return validationError(parsed);

  const updatedAt = readUpdatedAt(formData, dependencies.now(), true);
  if (updatedAt === undefined) return error(CONFLICT_MESSAGE);

  const result = await dependencies.save(parsed.value, updatedAt);
  if (result.status !== "ok") return repositoryError(result.status);

  return success(
    ["/admin/requisites", "/requisites"],
    "/admin/requisites?success=saved",
  );
}

export async function replaceInvalidRequisitesMutation(
  formData: FormData,
  dependencies: ReplaceRequisitesDependencies,
): Promise<MutationOutcome> {
  await dependencies.requireSession();
  const updatedAt = readUpdatedAt(formData, dependencies.now());
  if (!updatedAt) return error(CONFLICT_MESSAGE);

  const result = await dependencies.replace(updatedAt);
  if (result.status !== "ok") return repositoryError(result.status);

  return success(
    ["/admin/requisites", "/requisites"],
    "/admin/requisites?success=replaced",
  );
}
