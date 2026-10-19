"use client";

import { RefreshCw } from "lucide-react";
import { useActionState, useRef } from "react";

import type { ContentFormState } from "@/features/content-admin/mutations";
import type { AdminRequisitesResult } from "@/features/content-admin/repository";
import type { RequisitesInput } from "@/features/content-admin/types";

import styles from "../../admin.module.css";
import { FieldError, FormSuccess, SubmitButton } from "../content-ui";
import { useUnsavedChanges } from "../use-unsaved-changes";
import { UnsavedChangesNotice } from "../unsaved-changes-notice";
import ui from "../editorial.module.css";

type FormAction = (
  state: ContentFormState,
  formData: FormData,
) => Promise<ContentFormState>;

type RequisitesFormProps = {
  requisites: AdminRequisitesResult;
  saveAction: FormAction;
  replaceAction: FormAction;
  successMessage?: string;
};

const initialState: ContentFormState = { status: "idle", message: "" };

const statusLabels = {
  DRAFT: "Черновик",
  PUBLISHED: "Опубликован",
  ARCHIVED: "В архиве",
} as const;

const fields = [
  { name: "fullName", label: "Полное наименование", maxLength: 240 },
  { name: "shortName", label: "Краткое наименование", maxLength: 160 },
  { name: "ogrn", label: "ОГРН", maxLength: 13 },
  { name: "inn", label: "ИНН", maxLength: 10 },
  { name: "kpp", label: "КПП", maxLength: 9 },
  { name: "address", label: "Юридический адрес", maxLength: 500 },
  { name: "email", label: "Email", maxLength: 254, type: "email" },
  { name: "bankName", label: "Наименование банка", maxLength: 200 },
  { name: "recipientName", label: "Получатель", maxLength: 240 },
  { name: "checkingAccount", label: "Расчетный счет", maxLength: 20 },
  { name: "correspondentAccount", label: "Корреспондентский счет", maxLength: 20 },
  { name: "bik", label: "БИК", maxLength: 9 },
] as const satisfies readonly {
  name: Exclude<keyof RequisitesInput, "version" | "status">;
  label: string;
  maxLength: number;
  type?: string;
}[];

function InvalidRequisitesForm({
  replaceAction,
  requisites,
  successMessage,
}: {
  replaceAction: FormAction;
  requisites: Extract<AdminRequisitesResult, { status: "invalid" }>;
  successMessage?: string;
}) {
  const [state, formAction] = useActionState(replaceAction, initialState);

  return (
    <>
      <FormSuccess>{state.status === "idle" ? successMessage : undefined}</FormSuccess>
      <p className={styles.formMessage} role="alert">
        Сохраненные реквизиты повреждены и не могут быть показаны. Замените их безопасным черновиком.
      </p>
      {state.status === "error" ? (
        <p aria-label="Ошибка замены" className={styles.formMessage} role="alert">
          {state.message}
        </p>
      ) : null}
      <form action={formAction}>
        <input name="updatedAt" type="hidden" value={requisites.updatedAt.toISOString()} />
        <button
          className={styles.secondaryButton}
          onClick={(event) => {
            if (!window.confirm("Заменить поврежденные реквизиты безопасным черновиком?")) {
              event.preventDefault();
            }
          }}
          type="submit"
        >
          <RefreshCw aria-hidden="true" size={17} />
          Заменить безопасным черновиком
        </button>
      </form>
    </>
  );
}

export function RequisitesForm({
  requisites,
  saveAction,
  replaceAction,
  successMessage,
}: RequisitesFormProps) {
  if (requisites.status === "invalid") {
    return (
      <InvalidRequisitesForm
        replaceAction={replaceAction}
        requisites={requisites}
        successMessage={successMessage}
      />
    );
  }

  return (
    <ValidRequisitesForm
      key={requisites.updatedAt?.toISOString() ?? "new"}
      initialValues={requisites.value}
      saveAction={saveAction}
      successMessage={successMessage}
      updatedAt={requisites.updatedAt}
    />
  );
}

function ValidRequisitesForm({
  initialValues,
  saveAction,
  successMessage,
  updatedAt,
}: {
  initialValues: RequisitesInput;
  saveAction: FormAction;
  successMessage?: string;
  updatedAt: Date | null;
}) {
  const [state, formAction] = useActionState(saveAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const guard = useUnsavedChanges(formRef);
  const changedFields = [...fields, { name: "status" as const, label: "Публичный статус" }].filter((item) => guard.values[item.name] !== undefined && guard.values[item.name] !== guard.baseline[item.name]);

  function value(name: keyof RequisitesInput) {
    if (state.values && Object.hasOwn(state.values, name)) {
      return state.values[name] ?? "";
    }
    return initialValues[name];
  }

  const field = (name: keyof RequisitesInput) => ({
    "aria-describedby": `${name}-error`,
    "aria-invalid": Boolean(state.errors?.[name]),
  });

  return (
    <>
      <FormSuccess>{state.status === "idle" ? successMessage : undefined}</FormSuccess>
      {state.status === "error" ? (
        <p aria-label="Ошибка сохранения" className={styles.formMessage} role="alert">
          {state.message}
        </p>
      ) : null}

      <form ref={formRef} action={formAction} className={styles.loginForm}>
        <input name="version" type="hidden" value="1" />
        {updatedAt ? (
          <input name="updatedAt" type="hidden" value={updatedAt.toISOString()} />
        ) : null}

        {[
          { title: "Организация", names: ["fullName", "shortName", "ogrn", "inn", "kpp"] },
          { title: "Контакты", names: ["address", "email"] },
          { title: "Банковские сведения", names: ["bankName", "recipientName", "checkingAccount", "correspondentAccount", "bik"] },
        ].map((group) => <fieldset className={ui.section} key={group.title}>
          <legend>{group.title}</legend>
          {fields.filter((item) => group.names.includes(item.name)).map((item) => (
          <div className={styles.field} key={item.name}>
            <label htmlFor={item.name}>{item.label}</label>
            <input
              {...field(item.name)}
              defaultValue={String(value(item.name))}
              id={item.name}
              maxLength={item.maxLength}
              name={item.name}
              inputMode={["ogrn", "inn", "kpp", "checkingAccount", "correspondentAccount", "bik"].includes(item.name) ? "numeric" : undefined}
              type={"type" in item ? item.type : "text"}
            />
            <FieldError id={`${item.name}-error`}>
              {state.errors?.[item.name]}
            </FieldError>
          </div>
        ))}</fieldset>)}

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

        <UnsavedChangesNotice guard={guard} />
        {changedFields.length ? <section aria-label="Изменения перед сохранением">
          <table className={ui.diff}>
            <caption>Изменения перед сохранением</caption>
            <thead><tr><th scope="col">Поле</th><th scope="col">Было</th><th scope="col">Станет</th></tr></thead>
            <tbody>{changedFields.map((item) => <tr key={item.name}>
              <th scope="row">{item.label}</th>
              <td>{item.name === "status" ? statusLabels[guard.baseline.status as keyof typeof statusLabels] : guard.baseline[item.name] || "Нет данных"}</td>
              <td>{item.name === "status" ? statusLabels[guard.values.status as keyof typeof statusLabels] : guard.values[item.name] || "Нет данных"}</td>
            </tr>)}</tbody>
          </table>
          <button type="button" onClick={() => {
            const form = formRef.current;
            if (!form) return;
            for (const [name, value] of Object.entries(guard.baseline)) {
              const control = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
              if (control) control.value = value;
            }
            form.dispatchEvent(new Event("editorialchange", { bubbles: true }));
          }}>Отменить изменения</button>
        </section> : null}
        <SubmitButton pendingLabel="Сохранение...">Сохранить</SubmitButton>
        <a href="/requisites">Открыть публичные реквизиты</a>
        {state.status === "error" ? <a href="/admin/requisites">Загрузить актуальные реквизиты</a> : null}
      </form>
    </>
  );
}
