"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useFormStatus } from "react-dom";

import type { PublicationStatus } from "@/features/content-admin/types";

import styles from "../admin.module.css";

const STATUS_LABELS: Record<PublicationStatus, string> = {
  DRAFT: "Черновик",
  PUBLISHED: "Опубликован",
  ARCHIVED: "В архиве",
};

type ContentListItem = {
  id: string;
  title: string;
  status: PublicationStatus;
  updatedAt: string;
  editHref: string;
};

export function PublicationStatusBadge({
  status,
}: {
  status: PublicationStatus;
}) {
  return (
    <span
      className={`${styles.publicationStatus} ${styles[`publicationStatus${status}`]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function ContentList({
  caption,
  emptyMessage,
  items,
}: {
  caption: string;
  emptyMessage: string;
  items: ContentListItem[];
}) {
  if (items.length === 0) {
    return (
      <div className={styles.contentEmptyState} role="status">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={styles.contentTableViewport} tabIndex={0}>
      <table className={styles.contentTable}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Название</th>
            <th scope="col">Статус</th>
            <th scope="col">Изменено</th>
            <th scope="col">
              <span className={styles.visuallyHidden}>Действия</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <th scope="row">{item.title}</th>
              <td>
                <PublicationStatusBadge status={item.status} />
              </td>
              <td className={styles.contentUpdatedAt}>{item.updatedAt}</td>
              <td className={styles.contentActionCell}>
                <Link
                  aria-label={`Редактировать ${item.title}`}
                  className={styles.iconButton}
                  href={item.editHref}
                  title="Редактировать"
                >
                  <Pencil aria-hidden="true" size={17} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FieldError({
  children,
  id,
}: {
  children?: React.ReactNode;
  id: string;
}) {
  if (!children) {
    return null;
  }

  return (
    <p className={styles.fieldError} id={id} role="alert">
      {children}
    </p>
  );
}

export function FormSuccess({ children }: { children?: React.ReactNode }) {
  if (!children) {
    return null;
  }

  return (
    <p className={styles.formSuccess} role="status" aria-live="polite">
      {children}
    </p>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
}: {
  children: React.ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className={styles.primaryButton} disabled={pending} type="submit">
      {pending ? pendingLabel : children}
    </button>
  );
}

export function DeleteDraftButton({
  action,
  publishedAt,
  status,
}: {
  action: (formData: FormData) => void | Promise<void>;
  publishedAt: Date | string | null;
  status: PublicationStatus;
}) {
  if (status !== "DRAFT" || publishedAt !== null) {
    return null;
  }

  return (
    <form action={action}>
      <button
        className={styles.dangerButton}
        onClick={(event) => {
          if (
            !window.confirm(
              "Удалить черновик без возможности восстановления?",
            )
          ) {
            event.preventDefault();
          }
        }}
        type="submit"
      >
        <Trash2 aria-hidden="true" size={17} />
        Удалить
      </button>
    </form>
  );
}
