"use client";

import { RefreshCw } from "lucide-react";

import styles from "../admin.module.css";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;

  return (
    <section className={styles.adminError} aria-labelledby="admin-error-title">
      <h1 id="admin-error-title">Не удалось загрузить раздел</h1>
      <p>Данные временно недоступны. Повторите запрос.</p>
      <button className={styles.primaryButton} onClick={reset} type="button">
        <RefreshCw aria-hidden="true" size={18} />
        Повторить
      </button>
    </section>
  );
}
