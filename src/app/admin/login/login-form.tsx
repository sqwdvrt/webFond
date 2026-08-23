"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { LoginActionState } from "./actions";
import styles from "../admin.module.css";

type LoginFormProps = {
  action: (
    state: LoginActionState,
    formData: FormData,
  ) => Promise<LoginActionState>;
};

const initialState: LoginActionState = { status: "idle", message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className={styles.primaryButton} disabled={pending} type="submit">
      {pending ? "Вход..." : "Войти"}
    </button>
  );
}

export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const hasError = state.status === "error";

  return (
    <section className={styles.loginSection} aria-labelledby="admin-login-title">
      <div className={styles.loginPanel}>
        <span className={styles.eyebrow}>Фонд «Быть Добру»</span>
        <h1 id="admin-login-title">Вход в административную часть</h1>
        <p className={styles.intro}>
          Используйте учетные данные администратора фонда.
        </p>

        <form action={formAction} className={styles.loginForm}>
          <label className={styles.field}>
            <span>Логин</span>
            <input
              aria-describedby="admin-login-message"
              aria-invalid={hasError}
              autoComplete="username"
              name="username"
              required
              type="text"
            />
          </label>

          <label className={styles.field}>
            <span>Пароль</span>
            <input
              aria-describedby="admin-login-message"
              aria-invalid={hasError}
              autoComplete="current-password"
              name="password"
              required
              type="password"
            />
          </label>

          <p
            className={styles.formMessage}
            id="admin-login-message"
            role="status"
            aria-live="polite"
          >
            {state.message || "\u00a0"}
          </p>

          <SubmitButton />
        </form>
      </div>
    </section>
  );
}
