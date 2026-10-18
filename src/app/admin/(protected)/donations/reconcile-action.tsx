"use client";

import { useState } from "react";

import styles from "../../admin.module.css";

export function ReconcileDonationsAction() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reconcile() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/payments/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 25 }),
      });
      if (!response.ok) throw new Error("reconcile_failed");
      const result = (await response.json()) as {
        succeeded: number;
        canceled: number;
        pending: number;
        failed: number;
      };
      setMessage(
        `Проверено: успешно ${result.succeeded}, отменено ${result.canceled}, ожидают ${result.pending}, ошибок ${result.failed}`,
      );
    } catch {
      setMessage("Не удалось проверить платежи");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button className={styles.clearButton} disabled={busy} onClick={reconcile} type="button">
        {busy ? "Проверяем…" : "Проверить зависшие"}
      </button>
      {message ? <p className={styles.inlineNotice} role="status">{message}</p> : null}
    </div>
  );
}
