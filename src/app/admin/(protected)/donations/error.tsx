"use client";

import { RefreshCw } from "lucide-react";

import styles from "../../admin.module.css";

export default function DonationsError({ reset }: { reset: () => void }) {
  return (
    <section className={styles.donationsPage}>
      <div className={styles.emptyState}>
        <h1>Не удалось загрузить пожертвования</h1>
        <p>Повторите запрос. Если ошибка сохранится, проверьте подключение к базе.</p>
        <button className={styles.primaryButton} onClick={reset} type="button">
          <RefreshCw aria-hidden="true" size={18} />
          Повторить
        </button>
      </div>
    </section>
  );
}
