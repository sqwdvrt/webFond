"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { ContactFormState } from "@/features/contact/submit";

type ContactFormProps = {
  action: (
    state: ContactFormState,
    formData: FormData,
  ) => Promise<ContactFormState>;
};

const initialState: ContactFormState = { status: "idle", message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button button-primary" disabled={pending} type="submit">
      {pending ? "Отправка..." : "Отправить письмо"}
    </button>
  );
}

export function ContactForm({ action }: ContactFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const values = state.status === "success" ? undefined : state.values;

  return (
    <div className="contact-form">
      <h2 id="contact-form-title">Написать через сайт</h2>

      {state.status === "success" ? (
        <p className="contact-form-success" role="status">
          {state.message}
        </p>
      ) : null}
      {state.status === "error" ? (
        <p className="contact-form-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <form
        action={formAction}
        aria-describedby="contact-form-privacy"
        aria-labelledby="contact-form-title"
        key={state.status === "success" ? state.message : "contact-form"}
      >
        <label className="contact-field">
          Имя
          <input
            aria-describedby="contact-name-error"
            aria-invalid={Boolean(state.errors?.name)}
            autoComplete="name"
            defaultValue={values?.name ?? ""}
            id="contact-name"
            maxLength={80}
            name="name"
            required
            type="text"
          />
        </label>
        {state.errors?.name ? (
          <p className="contact-form-error" id="contact-name-error" role="alert">
            {state.errors.name}
          </p>
        ) : null}

        <label className="contact-field">
          Электронная почта
          <input
            aria-describedby="contact-email-error"
            aria-invalid={Boolean(state.errors?.email)}
            autoComplete="email"
            defaultValue={values?.email ?? ""}
            id="contact-email"
            maxLength={254}
            name="email"
            required
            type="email"
          />
        </label>
        {state.errors?.email ? (
          <p className="contact-form-error" id="contact-email-error" role="alert">
            {state.errors.email}
          </p>
        ) : null}

        <label className="contact-field">
          Сообщение
          <textarea
            aria-describedby="contact-message-error"
            aria-invalid={Boolean(state.errors?.message)}
            defaultValue={values?.message ?? ""}
            id="contact-message"
            maxLength={4000}
            name="message"
            required
            rows={7}
          />
        </label>
        {state.errors?.message ? (
          <p className="contact-form-error" id="contact-message-error" role="alert">
            {state.errors.message}
          </p>
        ) : null}

        <label className="donation-honeypot">
          Сайт
          <input autoComplete="off" name="website" tabIndex={-1} type="text" />
        </label>

        <p className="contact-form-privacy" id="contact-form-privacy">
          Отправляя сообщение, вы соглашаетесь, что фонд обработает имя и почту,
          чтобы ответить. Подробности в{" "}
          <a href="/privacy">политике конфиденциальности</a>.
        </p>

        <SubmitButton />
      </form>
    </div>
  );
}
