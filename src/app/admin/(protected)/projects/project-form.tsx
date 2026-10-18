"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { siteConfig } from "@/config/site";
import { projectSlug } from "@/features/content-admin/project-slug";

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

  const formRef = useRef<HTMLFormElement>(null);
  const customSlug = useRef(mode === "edit" || Boolean(value("slug")));
  const [slugPreview, setSlugPreview] = useState(String(value("slug")));
  const [lengths, setLengths] = useState({
    title: String(value("title")).length,
    summary: String(value("summary")).length,
    content: String(value("content")).length,
  });

  useEffect(() => {
    if (state.status === "error") {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

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
    "aria-describedby": `${name}-hint ${name}-error`,
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

      <form ref={formRef} action={formAction} className={styles.loginForm}>
        {mode === "edit" && initialValues ? (
          <input
            name="updatedAt"
            type="hidden"
            value={initialValues.updatedAt.toISOString()}
          />
        ) : null}

        <fieldset className={styles.projectFormSection}>
          <legend>Основная информация</legend>
          <p className={styles.fieldHint}>Название и адрес обязательны. Остальные поля можно заполнить позже в черновике.</p>
        <div className={styles.field}>
          <label htmlFor="title">Название</label>
          <input {...field("title")} defaultValue={String(value("title"))} id="title" maxLength={160} name="title" required onChange={(event) => {
            const title = event.currentTarget.value;
            setLengths((current) => ({ ...current, title: title.length }));
            if (!customSlug.current) {
              const slug = projectSlug(title);
              const input = formRef.current?.elements.namedItem("slug") as HTMLInputElement | null;
              if (input) input.value = slug;
              setSlugPreview(slug);
            }
          }} />
          <p id="title-hint" className={styles.fieldHint}>Например: «Помощь детям». {lengths.title} / 160</p>
          <FieldError id="title-error">{state.errors?.title}</FieldError>
        </div>

        <div className={styles.field}>
          <label htmlFor="slug">Адрес страницы</label>
          <input {...field("slug")} defaultValue={String(value("slug"))} id="slug" maxLength={120} name="slug" required autoCapitalize="none" spellCheck={false} onChange={(event) => {
            customSlug.current = true;
            setSlugPreview(event.currentTarget.value);
          }} />
          <p id="slug-hint" className={styles.fieldHint}>
            {mode === "create" ? "Заполняется из названия. Можно изменить: строчные латинские буквы, цифры и дефисы." : "Изменение адреса сделает старую ссылку недоступной."}
            <span className={styles.projectUrl}>{siteConfig.siteUrl.origin}/projects/{slugPreview || "adres-proekta"}</span>
          </p>
          <FieldError id="slug-error">{state.errors?.slug}</FieldError>
        </div>

        </fieldset>
        <fieldset className={styles.projectFormSection}>
          <legend>Описание и фото</legend>

        <div className={styles.field}>
          <label htmlFor="summary">Краткое описание</label>
          <textarea {...field("summary")} defaultValue={String(value("summary"))} id="summary" maxLength={500} name="summary" rows={4} onChange={(event) => setLengths((current) => ({ ...current, summary: event.target.value.length }))} />
          <p id="summary-hint" className={styles.fieldHint}>Текст для карточки проекта. Для публикации: от 10 символов. {lengths.summary} / 500</p>
          <FieldError id="summary-error">{state.errors?.summary}</FieldError>
        </div>

        <div className={styles.field}>
          <label htmlFor="content">Содержание</label>
          <textarea {...field("content")} defaultValue={String(value("content"))} id="content" maxLength={20_000} name="content" rows={8} onChange={(event) => setLengths((current) => ({ ...current, content: event.target.value.length }))} />
          <p id="content-hint" className={styles.fieldHint}>Кому нужна помощь, на что пойдут средства и какой результат ожидается. Для публикации: от 20 символов. {lengths.content} / 20 000</p>
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

        </fieldset>
        <fieldset className={styles.projectFormSection}>
          <legend>Сбор средств</legend>

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
          <p id="goalAmountRoubles-hint" className={styles.fieldHint}>
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
          <p id="manualRaisedRoubles-hint" className={styles.fieldHint}>
            Необязательно. Банковский перевод, наличные и другие суммы вне ЮKassa.
            Успешные онлайн-пожертвования добавляются автоматически.
          </p>
          <FieldError id="manualRaisedRoubles-error">{state.errors?.manualRaisedRoubles}</FieldError>
        </div>

        </fieldset>
        <fieldset className={styles.projectFormSection}>
          <legend>Публикация</legend>

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
          <p id="status-hint" className={styles.fieldHint}>Черновик виден только в админке. Опубликованный проект доступен посетителям. Архив скрывает проект из публичного списка.</p>
          <FieldError id="status-error">{state.errors?.status}</FieldError>
        </div>
        </fieldset>

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
