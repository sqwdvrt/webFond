"use client";

import { useActionState, useRef } from "react";

import type { ContactMutationState } from "@/features/admin-messages/mutation";
import { CONTACT_STATUS_LABELS } from "@/features/admin-messages/presentation";
import type { getAdminContactRequest } from "@/features/admin-messages/repository";
import { CONTACT_STATUSES } from "@/features/admin-messages/types";

import styles from "../../admin.module.css";
import { useUnsavedChanges } from "../use-unsaved-changes";
import { UnsavedChangesNotice } from "../unsaved-changes-notice";

type ContactDetail = NonNullable<Awaited<ReturnType<typeof getAdminContactRequest>>>;

type MessageFormAction = (
  state: ContactMutationState,
  formData: FormData,
) => Promise<ContactMutationState>;

const initialState: ContactMutationState = { status: "idle", message: "" };

export function MessageForm(props: {
  action: MessageFormAction;
  contact: Pick<ContactDetail, "status" | "internalNote" | "updatedAt">;
  successMessage?: string;
}) {
  return <MessageFormEditor key={props.contact.updatedAt.toISOString()} {...props} />;
}

function MessageFormEditor({
  action,
  contact,
  successMessage,
}: {
  action: MessageFormAction;
  contact: Pick<ContactDetail, "status" | "internalNote" | "updatedAt">;
  successMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const guard = useUnsavedChanges(formRef);
  const status = state.values && Object.hasOwn(state.values, "status")
    ? state.values.status
    : contact.status;
  const note = state.values && Object.hasOwn(state.values, "note")
    ? state.values.note ?? ""
    : contact.internalNote ?? "";

  return (
    <section className={styles.messageEdit} aria-labelledby="message-edit-title">
      <h2 id="message-edit-title">Обработка обращения</h2>
      <p className={styles.fieldHint}>Обновите этап обработки и запишите результат, чтобы коллеги могли продолжить работу.</p>
      {state.status === "idle" && successMessage ? (
        <p className={styles.formSuccess} role="status">{successMessage}</p>
      ) : null}
      {state.status === "error" ? (
        <p aria-label="Ошибка сохранения" className={styles.formMessage} role="alert">
          {state.message}
        </p>
      ) : null}

      <form ref={formRef} action={formAction} className={styles.messageEditForm}>
        <input name="updatedAt" type="hidden" value={contact.updatedAt.toISOString()} />

        <div className={styles.field}>
          <label htmlFor="contact-status">Статус обращения</label>
          <select
            aria-describedby={`contact-status-help${state.errors?.status ? " contact-status-error" : ""}`}
            aria-invalid={Boolean(state.errors?.status)}
            defaultValue={status}
            id="contact-status"
            key={status}
            name="status"
          >
            {CONTACT_STATUSES.map((value) => (
              <option key={value} value={value}>{CONTACT_STATUS_LABELS[value]}</option>
            ))}
          </select>
          <p className={styles.fieldHint} id="contact-status-help">Выберите текущий этап. Смена статуса сохраняется в истории обращения.</p>
          {state.errors?.status ? (
            <p className={styles.fieldError} id="contact-status-error" role="alert">
              {state.errors.status}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label htmlFor="contact-note">Внутренняя заметка</label>
          <p className={styles.fieldHint} id="contact-note-help">
            Видна только администраторам. Не добавляйте пароли и другие секреты.
          </p>
          <textarea
            aria-describedby={`contact-note-help${state.errors?.note ? " contact-note-error" : ""}`}
            aria-invalid={Boolean(state.errors?.note)}
            defaultValue={note}
            id="contact-note"
            key={note}
            maxLength={4000}
            name="note"
          />
          <p className={styles.fieldHint}>{(guard.values.note ?? note).length} / 4000</p>
          {state.errors?.note ? (
            <p className={styles.fieldError} id="contact-note-error" role="alert">
              {state.errors.note}
            </p>
          ) : null}
        </div>

        <UnsavedChangesNotice guard={guard} />
        <button className={styles.primaryButton} disabled={pending} type="submit">
          {pending ? "Сохранение..." : "Сохранить обращение"}
        </button>
      </form>
    </section>
  );
}
