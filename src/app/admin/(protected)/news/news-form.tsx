"use client";

import { useActionState, useRef } from "react";

import { projectSlug } from "@/features/content-admin/project-slug";

import { safeContentReturnTo } from "@/features/content-admin/list-filters";

import type { ContentFormState } from "@/features/content-admin/mutations";
import type { AdminEditorialRow } from "@/features/content-admin/repository";

import styles from "../../admin.module.css";
import {
  DeleteDraftButton,
  FieldError,
  FormSuccess,
} from "../content-ui";
import { MediaUrlField } from "../media-url-field";
import { useUnsavedChanges } from "../use-unsaved-changes";
import { UnsavedChangesNotice } from "../unsaved-changes-notice";
import { PublicationControls } from "../publication-controls";
import { EditorialPreview } from "../editorial-preview";

type FormAction = (
  state: ContentFormState,
  formData: FormData,
) => Promise<ContentFormState>;

type NewsFormProps = {
  mode: "create" | "edit";
  saveAction: FormAction;
  deleteAction?: FormAction;
  initialValues?: AdminEditorialRow;
  successMessage?: string;
  returnTo?: string;
};

const initialState: ContentFormState = { status: "idle", message: "" };

async function idleDeleteAction(
  state: ContentFormState,
  formData: FormData,
) {
  void formData;
  return state;
}

export function NewsForm(props: NewsFormProps) {
  return <NewsFormEditor key={props.initialValues?.updatedAt.toISOString() ?? "new"} {...props} />;
}

function NewsFormEditor({
  mode,
  saveAction,
  deleteAction,
  initialValues,
  successMessage,
  returnTo,
}: NewsFormProps) {
  const listUrl = safeContentReturnTo(returnTo, "/admin/news");
  const formRef = useRef<HTMLFormElement>(null);
  const guard = useUnsavedChanges(formRef);
  const customSlug = useRef(mode === "edit");
  const [state, formAction] = useActionState(saveAction, initialState);
  const [deleteState, deleteFormAction] = useActionState(
    deleteAction ?? idleDeleteAction,
    initialState,
  );

  function value(name: "title" | "slug" | "summary" | "content" | "imageUrl" | "status") {
    if (state.values && Object.hasOwn(state.values, name)) {
      return state.values[name] ?? "";
    }
    return initialValues?.[name] ?? (name === "status" ? "DRAFT" : "");
  }

  const field = (
    name: "title" | "slug" | "summary" | "content" | "imageUrl" | "status",
  ) => ({
    "aria-describedby": `${name}-error`,
    "aria-invalid": Boolean(state.errors?.[name]),
  });

  const runDelete = deleteAction && initialValues
    ? (formData: FormData) => {
        formData.set("returnTo", listUrl);
        formData.set("updatedAt", initialValues.updatedAt.toISOString());
        deleteFormAction(formData);
      }
    : undefined;

  return (
    <>
      <FormSuccess>{state.status === "idle" ? successMessage : undefined}</FormSuccess>
      {state.status === "error" ? (
        <p
          aria-label="Ошибка сохранения"
          className={styles.formMessage}
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <form ref={formRef} action={formAction} className={styles.loginForm}>
        <input type="hidden" name="returnTo" value={listUrl} />
        {mode === "edit" && initialValues ? (
          <input
            name="updatedAt"
            type="hidden"
            value={initialValues.updatedAt.toISOString()}
          />
        ) : null}

        <div className={styles.field}>
          <label htmlFor="title">Заголовок</label>
          <input {...field("title")} defaultValue={String(value("title"))} id="title" maxLength={160} name="title" required onChange={(event) => {
            if (customSlug.current) return;
            const input = formRef.current?.elements.namedItem("slug") as HTMLInputElement | null;
            if (input) {
              input.value = projectSlug(event.currentTarget.value);
              input.dispatchEvent(new Event("editorialchange", { bubbles: true }));
            }
          }} />
          <FieldError id="title-error">{state.errors?.title}</FieldError>
        </div>

        <div className={styles.field}>
          <label htmlFor="slug">Адрес страницы</label>
          <input {...field("slug")} defaultValue={String(value("slug"))} id="slug" maxLength={120} name="slug" required autoCapitalize="none" spellCheck={false} onChange={() => { customSlug.current = true; }} />
          <FieldError id="slug-error">{state.errors?.slug}</FieldError>
        </div>

        <div className={styles.field}>
          <label htmlFor="summary">Краткое описание</label>
          <textarea {...field("summary")} defaultValue={String(value("summary"))} id="summary" maxLength={500} name="summary" rows={4} />
          <FieldError id="summary-error">{state.errors?.summary}</FieldError>
        </div>

        <div className={styles.field}>
          <label htmlFor="content">Содержание</label>
          <textarea {...field("content")} defaultValue={String(value("content"))} id="content" maxLength={20_000} name="content" rows={12} />
          <FieldError id="content-error">{state.errors?.content}</FieldError>
        </div>

        <MediaUrlField
          accept="image/jpeg,image/png,image/webp"
          describedBy="imageUrl-error"
          error={state.errors?.imageUrl}
          hint="Можно вставить ссылку или загрузить JPEG, PNG, WebP."
          id="imageUrl"
          key={String(value("imageUrl"))}
          kind="image"
          label="Изображение"
          name="imageUrl"
          uploadLabel="Загрузить изображение"
          value={String(value("imageUrl"))}
        />

        <FieldError id="status-error">{state.errors?.status}</FieldError>

        <UnsavedChangesNotice guard={guard} />
        <EditorialPreview values={guard.values} />
        <PublicationControls status={initialValues?.status ?? "DRAFT"} uploading={guard.uploading} missing={[!guard.values.title?.trim() && "название", !guard.values.slug?.trim() && "адрес", (guard.values.summary?.trim().length ?? 0) < 10 && "краткое описание (от 10 символов)", (guard.values.content?.trim().length ?? 0) < 20 && "содержание (от 20 символов)"].filter((item): item is string => Boolean(item))} />
      </form>

      {runDelete && initialValues ? (
        <>
          {deleteState.status === "error" ? (
            <p
              aria-label="Ошибка удаления"
              className={styles.formMessage}
              role="alert"
            >
              {deleteState.message}
            </p>
          ) : null}
          <DeleteDraftButton
            action={runDelete}
            publishedAt={initialValues.publishedAt}
            status={initialValues.status}
          />
        </>
      ) : null}
    </>
  );
}
