"use client";

import { useEffect, useRef } from "react";
import type { useUnsavedChanges } from "./use-unsaved-changes";
import styles from "./editorial.module.css";

export function UnsavedChangesNotice({ guard }: { guard: ReturnType<typeof useUnsavedChanges> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (guard.departure) {
      opener.current = guard.departure;
      if (!dialog.current?.open) dialog.current?.showModal();
    } else if (dialog.current?.open) {
      dialog.current.close();
      opener.current?.focus();
    }
  }, [guard.departure]);
  return <>
    {guard.dirty ? <p className={styles.notice} role="status">Есть несохранённые изменения</p> : null}
    {guard.uploading ? <p role="status">Дождитесь завершения загрузки перед сохранением.</p> : null}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="unsaved-title" onCancel={(event) => { event.preventDefault(); guard.stay(); }}>
      <h2 id="unsaved-title">Уйти без сохранения?</h2>
      <p>Несохранённые изменения будут потеряны.</p>
      <div className={styles.actions}>
        <button type="button" autoFocus onClick={guard.stay}>Остаться</button>
        <button type="button" onClick={guard.leave}>Уйти</button>
      </div>
    </dialog>
  </>;
}
