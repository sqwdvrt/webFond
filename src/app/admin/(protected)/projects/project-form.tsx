"use client";

import { useActionState } from "react";

import type { ContentFormState } from "@/features/content-admin/mutations";
import type { AdminProjectRow } from "@/features/content-admin/repository";

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

type ProjectFormProps = {
  mode: "create" | "edit";
  saveAction: FormAction;
  deleteAction?: FormAction;
  initialValues?: AdminProjectRow;
  successMessage?: string;
};

const initialState: ContentFormState = { status: "idle", message: "" };

async function idleDeleteAction(
  state: ContentFormState,
  formData: FormData,
) {
  void formData;
  return state;
}

const statusLabels = {
  DRAFT: "Черновик",
  PUBLISHED: "Опубликован",
  ARCHIVED: "В архиве",
} as const;

export function ProjectForm({
  mode,
  saveAction,
  deleteAction,
  initialValues,
  successMessage,
}: ProjectFormProps) {
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

  function roubleValue(name: "goalAmountRoubles" | "manualRaisedRoubles") {
    if (state.values && Object.hasOwn(state.values, name)) {
      return String(state.values[name] ?? "");
    }

    const kopecks =
      name === "goalAmountRoubles"
        ? state.values && Object.hasOwn(state.values, "goalAmountKopecks")
          ? state.values.goalAmountKopecks
          : initialValues?.goalAmountKopecks
        : state.values && Object.hasOwn(state.values, "manualRaisedKopecks")
          ? state.values.manualRaisedKopecks
          : initialValues?.manualRaisedKopecks;

    if (kopecks == null || kopecks === "") return "";
    const amount = typeof kopecks === "number" ? kopecks : Number(kopecks);
    if (!Number.isFinite(amount) || amount === 0 && name === "manualRaisedRoubles") {
      return name === "goalAmountRoubles" && amount === 0 ? "0" : "";
    }
    if (!Number.isFinite(amount)) return "";
    return String(amount / 100);
  }

  const field = (
    name:
      | "title"
      | "slug"
      | "summary"
      | "content"
      | "imageUrl"
      | "status"
      | "goalAmountRoubles"
      | "manualRaisedRoubles",
  ) => ({
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
        <p
          aria-label="Ошибка сохранения"
          className={styles.formMessage}
          role="alert"
        >
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
          <label htmlFor="slug">Адрес страницы</label>
          <input {...field("slug")} defaultValue={String(value("slug"))} id="slug" maxLength={120} name="slug" required />
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
          kind="image"
          label="Изображение"
          name="imageUrl"
          uploadLabel="Загрузить изображение"
          value={String(value("imageUrl"))}
        />

        <div className={styles.field}>
          <label htmlFor="goalAmountRoubles">Цель сбора, ₽</label>
          <input
            {...field("goalAmountRoubles")}
            defaultValue={roubleValue("goalAmountRoubles")}
            id="goalAmountRoubles"
            inputMode="numeric"
            maxLength={8}
            name="goalAmountRoubles"
          />
          <p className={styles.fieldHint}>
            Необязательно. Если цель не задана, шкала на сайте не показывается.
          </p>
          <FieldError id="goalAmountRoubles-error">{state.errors?.goalAmountRoubles}</FieldError>
        </div>

        <div className={styles.field}>
          <label htmlFor="manualRaisedRoubles">Уже собрано вне сайта, ₽</label>
          <input
            {...field("manualRaisedRoubles")}
            defaultValue={roubleValue("manualRaisedRoubles")}
            id="manualRaisedRoubles"
            inputMode="numeric"
            maxLength={8}
            name="manualRaisedRoubles"
          />
          <p className={styles.fieldHint}>
            Банковский перевод, наличные и другие суммы вне ЮKassa.
          </p>
          <FieldError id="manualRaisedRoubles-error">{state.errors?.manualRaisedRoubles}</FieldError>
        </div>

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
          {mode === "create" ? "Создать проект" : "Сохранить"}
        </SubmitButton>
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
