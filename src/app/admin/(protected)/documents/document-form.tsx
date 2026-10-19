"use client";

import { useActionState, useRef } from "react";

import { safeContentReturnTo } from "@/features/content-admin/list-filters";

import type { ContentFormState } from "@/features/content-admin/mutations";
import type { AdminDocumentRow } from "@/features/content-admin/repository";

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
  returnTo?: string;
};

const initialState: ContentFormState = { status: "idle", message: "" };

async function idleDeleteAction(state: ContentFormState, formData: FormData) {
  void formData;
  return state;
}

type DocumentField = "title" | "category" | "fileUrl" | "status";

export function DocumentForm(props: DocumentFormProps) {
  return <DocumentFormEditor key={props.initialValues?.updatedAt.toISOString() ?? "new"} {...props} />;
}

function DocumentFormEditor({
  mode,
  saveAction,
  deleteAction,
  initialValues,
  successMessage,
  returnTo,
}: DocumentFormProps) {
  const listUrl = safeContentReturnTo(returnTo, "/admin/documents");
  const formRef = useRef<HTMLFormElement>(null);
  const guard = useUnsavedChanges(formRef);
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
        formData.set("returnTo", listUrl);
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
          key={String(value("fileUrl"))}
          kind="document"
          label="Ссылка на документ"
          name="fileUrl"
          required
          uploadLabel="Загрузить документ"
          value={String(value("fileUrl"))}
        />

        <FieldError id="status-error">{state.errors?.status}</FieldError>

        <UnsavedChangesNotice guard={guard} />
        <PublicationControls status={initialValues?.status ?? "DRAFT"} uploading={guard.uploading} missing={[!guard.values.title && "название", !guard.values.category && "категория", !guard.values.fileUrl && "PDF"].filter((item): item is string => Boolean(item))} />
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
