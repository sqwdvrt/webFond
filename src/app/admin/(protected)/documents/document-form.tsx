"use client";

import { useActionState, useEffect, useRef } from "react";

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

  useEffect(() => {
    if (state.status === "error") formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  function value(name: DocumentField) {
    if (state.values && Object.hasOwn(state.values, name)) {
      return state.values[name] ?? "";
    }
    return initialValues?.[name] ?? (name === "status" ? "DRAFT" : "");
  }

  const field = (name: DocumentField) => ({
    "aria-describedby": `${name}-help ${name}-error`,
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

        <fieldset className={styles.projectFormSection}>
          <legend>О документе</legend>
          <p className={styles.fieldHint}>Укажите понятное название и категорию, чтобы посетителям было проще найти документ.</p>
        <div className={styles.field}>
          <label htmlFor="title">Название</label>
          <input {...field("title")} defaultValue={String(value("title"))} id="title" maxLength={160} name="title" required />
          <p className={styles.fieldHint} id="title-help">Например: «Годовой отчет за 2026 год». {(guard.values.title ?? String(value("title"))).length} / 160</p>
          <FieldError id="title-error">{state.errors?.title}</FieldError>
        </div>

        <div className={styles.field}>
          <label htmlFor="category">Категория</label>
          <input {...field("category")} defaultValue={String(value("category"))} id="category" maxLength={80} name="category" required />
          <p className={styles.fieldHint} id="category-help">Например: «Отчеты», «Учредительные документы». Используйте одинаковые названия для одной категории. {(guard.values.category ?? String(value("category"))).length} / 80</p>
          <FieldError id="category-error">{state.errors?.category}</FieldError>
        </div>
        </fieldset>

        <fieldset className={styles.projectFormSection}>
          <legend>Файл документа</legend>
          <p className={styles.fieldHint}>Загрузите PDF или укажите ссылку. Перед публикацией откройте файл и проверьте его содержимое.</p>
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
        </fieldset>

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
