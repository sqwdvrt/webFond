"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import styles from "../../admin.module.css";

export function ReconcileDonationsAction({ donationId }: { donationId?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reconcile() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/payments/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(donationId ? { mode: "single", donationId } : { mode: "batch", limit: 25 }),
      });
      if (response.status === 401) { setMessage("Сессия истекла. Войдите в админку снова."); return; }
      if (response.status === 409) { setMessage("Проверка уже выполняется"); return; }
      if (response.status === 429) { setMessage("Слишком много проверок. Повторите через минуту."); return; }
      if (!response.ok) throw new Error("reconcile_failed");
      const result = (await response.json()) as {
        succeeded: number;
        canceled: number;
        pending: number;
        failed: number;
        skipped?: number;
        kind?: string;
      };
      const labels: Record<string, string> = { succeeded: "Оплата подтверждена", canceled: "Платёж отменён", pending: "Оплата ещё не завершена", failed: "Нужна проверка: подробности в таблице", "already-terminal": "Платёж уже имеет конечный статус" };
      setMessage(result.kind ? labels[result.kind] ?? "Проверка завершена" : result.succeeded + result.canceled + result.pending + result.failed + (result.skipped ?? 0) === 0 ? "Нет платежей, готовых к проверке" : `Успешно: ${result.succeeded}, отменено: ${result.canceled}, ожидают: ${result.pending}, ошибок: ${result.failed}, пропущено: ${result.skipped ?? 0}`);
      router.refresh();
    } catch {
      setMessage("Не удалось проверить платежи");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button className={styles.clearButton} disabled={busy} onClick={reconcile} type="button">
        {busy ? "Проверяем…" : donationId ? "Проверить в ЮKassa" : "Проверить зависшие"}
      </button>
      {message ? <p className={styles.inlineNotice} role="status">{message}</p> : null}
    </div>
  );
}
