"use client";

import { RefreshCw } from "lucide-react";
import { useActionState } from "react";

import type { ContentFormState } from "@/features/content-admin/mutations";
import type { AdminRequisitesResult } from "@/features/content-admin/repository";
import type { RequisitesInput } from "@/features/content-admin/types";

import styles from "../../admin.module.css";
import { FieldError, FormSuccess, SubmitButton } from "../content-ui";

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

      <form action={formAction} className={styles.loginForm}>
        <input name="version" type="hidden" value="1" />
        {updatedAt ? (
          <input name="updatedAt" type="hidden" value={updatedAt.toISOString()} />
        ) : null}

        {fields.map((item) => (
          <div className={styles.field} key={item.name}>
            <label htmlFor={item.name}>{item.label}</label>
            <input
              {...field(item.name)}
              defaultValue={String(value(item.name))}
              id={item.name}
              maxLength={item.maxLength}
              name={item.name}
              type={"type" in item ? item.type : "text"}
            />
            <FieldError id={`${item.name}-error`}>
              {state.errors?.[item.name]}
            </FieldError>
          </div>
        ))}

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

        <SubmitButton pendingLabel="Сохранение...">Сохранить</SubmitButton>
      </form>
    </>
  );
}
