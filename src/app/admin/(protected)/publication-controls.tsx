"use client";

import { useFormStatus } from "react-dom";
import styles from "./editorial.module.css";

export function PublicationControls({ status, uploading, missing = [] }: { status: string; uploading: boolean; missing?: string[] }) {
  const { pending } = useFormStatus();
  const actions = status === "PUBLISHED"
    ? [["PUBLISHED", "Сохранить изменения"], ["ARCHIVED", "В архив"]]
    : status === "ARCHIVED"
      ? [["ARCHIVED", "Сохранить изменения"], ["DRAFT", "В черновик"], ["PUBLISHED", "Опубликовать"]]
      : [["DRAFT", "Сохранить черновик"], ["PUBLISHED", "Опубликовать"]];
  return <section className={styles.section} aria-label="Публикация">
    <p>Публикация делает материал доступным посетителям. Черновик и архив скрыты с сайта.</p>
    {missing.length ? <p>Для публикации заполните: {missing.join(", ")}. Требования проверяются при сохранении.</p> : null}
    <div className={styles.actions}>{actions.map(([value, label]) => <button key={value} type="submit" name="status" value={value} disabled={pending || uploading}>{pending ? "Сохранение..." : label}</button>)}</div>
  </section>;
}
