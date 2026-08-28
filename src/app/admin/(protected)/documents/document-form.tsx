"use client";

import { useActionState } from "react";

import type { ContentFormState } from "@/features/content-admin/mutations";
import type { AdminDocumentRow } from "@/features/content-admin/repository";

import styles from "../../admin.module.css";
import {
  DeleteDraftButton,
  FieldError,
  FormSuccess,
  SubmitButton,
} from "../content-ui";
import { MediaUrlField } from "../media-url-field";

type FormAction = (
  state: ContentFormState,
  formData: FormData,
) => Promise<ContentFormState>;

type DocumentFormProps = {
  mode: "create" | "edit";
  saveAction: FormAction;
  deleteAction?: FormAction;
  initialValues?: AdminDocumentRow;
  successMessage?: string;
};

const initialState: ContentFormState = { status: "idle", message: "" };

async function idleDeleteAction(state: ContentFormState, formData: FormData) {
  void formData;
  return state;
}

const statusLabels = {
  DRAFT: "Черновик",
  PUBLISHED: "Опубликован",
  ARCHIVED: "В архиве",
} as const;

type DocumentField = "title" | "category" | "fileUrl" | "status";

export function DocumentForm({
  mode,
  saveAction,
  deleteAction,
  initialValues,
  successMessage,
}: DocumentFormProps) {
  const [state, formAction] = useActionState(saveAction, initialState);
  const [deleteState, deleteFormAction] = useActionState(
    deleteAction ?? idleDeleteAction,
    initialState,
  );

  function value(name: DocumentField) {
    if (state.values && Object.hasOwn(state.values, name)) {
      return state.values[name] ?? "";
    }
    return initialValues?.[name] ?? (name === "status" ? "DRAFT" : "");
  }

  const field = (name: DocumentField) => ({
    "aria-describedby": `${name}-error`,
    "aria-invalid": Boolean(state.errors?.[name]),
  });

  const runDelete = deleteAction && initialValues
    ? (formData: FormData) => {
        formData.set("updatedAt", initialValues.updatedAt.toISOString());
        deleteFormAction(formData);
      }
    : undefined;

  return (
    <>
      <FormSuccess>{state.status === "idle" ? successMessage : undefined}</FormSuccess>
      {state.status === "error" ? (
        <p aria-label="Ошибка сохранения" className={styles.formMessage} role="alert">
          {state.message}
        </p>
      ) : null}

      <form action={formAction} className={styles.loginForm}>
        {mode === "edit" && initialValues ? (
          <input
            name="updatedAt"
            type="hidden"
            value={initialValues.updatedAt.toISOString()}
          />
        ) : null}

        <div className={styles.field}>
          <label htmlFor="title">Название</label>
          <input {...field("title")} defaultValue={String(value("title"))} id="title" maxLength={160} name="title" required />
          <FieldError id="title-error">{state.errors?.title}</FieldError>
        </div>

        <div className={styles.field}>
          <label htmlFor="category">Категория</label>
          <input {...field("category")} defaultValue={String(value("category"))} id="category" maxLength={80} name="category" required />
          <FieldError id="category-error">{state.errors?.category}</FieldError>
        </div>

        <MediaUrlField
          accept="application/pdf"
          describedBy="fileUrl-error"
          error={state.errors?.fileUrl}
          hint="Можно вставить ссылку или загрузить PDF."
          id="fileUrl"
          kind="document"
          label="Ссылка на документ"
          name="fileUrl"
          required
          uploadLabel="Загрузить документ"
          value={String(value("fileUrl"))}
        />

        <div className={styles.field}>
          <label htmlFor="status">Статус</label>
          <select
            {...field("status")}
            defaultValue={String(value("status"))}
            id="status"
            key={String(value("status"))}
            name="status"
          >
            {Object.entries(statusLabels).map(([status, label]) => (
              <option key={status} value={status}>{label}</option>
            ))}
          </select>
          <FieldError id="status-error">{state.errors?.status}</FieldError>
        </div>

        <SubmitButton pendingLabel="Сохранение...">
          {mode === "create" ? "Создать документ" : "Сохранить"}
        </SubmitButton>
      </form>

      {runDelete && initialValues ? (
        <>
          {deleteState.status === "error" ? (
            <p aria-label="Ошибка удаления" className={styles.formMessage} role="alert">
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
