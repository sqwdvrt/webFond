"use client";

import { useEffect, useState } from "react";

import styles from "../admin.module.css";
import { FieldError } from "./content-ui";

type MediaUrlFieldProps = {
  accept: string;
  describedBy: string;
  error?: string;
  hint: string;
  id: string;
  kind: "image" | "document";
  label: string;
  name: string;
  required?: boolean;
  uploadLabel: string;
  value: string;
};

export function MediaUrlField({
  accept,
  describedBy,
  error,
  hint,
  id,
  kind,
  label,
  name,
  required,
  uploadLabel,
  value,
}: MediaUrlFieldProps) {
  const [url, setUrl] = useState(value);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    setUrl(value);
  }, [value]);

  async function onFileChange(file: File | undefined) {
    if (!file) {
      return;
    }

    setBusy(true);
    setUploadError("");

    try {
      const body = new FormData();
      body.set("kind", kind);
      body.set("file", file);
      const response = await fetch("/api/admin/uploads", {
        method: "POST",
        body,
      });
      const payload = (await response.json()) as {
        url?: string;
        message?: string;
      };

      if (!response.ok || !payload.url) {
        setUploadError(
          payload.message ?? "Не получилось загрузить файл. Вставьте ссылку.",
        );
        return;
      }

      setUrl(payload.url);
    } catch {
      setUploadError("Не получилось загрузить файл. Вставьте ссылку.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        id={id}
        maxLength={2048}
        name={name}
        onChange={(event) => setUrl(event.target.value)}
        required={required}
        type="text"
        value={url}
      />
      <label className={styles.uploadFileLabel} htmlFor={`${id}-file`}>
        {uploadLabel}
        <input
          accept={accept}
          disabled={busy}
          id={`${id}-file`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void onFileChange(file);
          }}
          type="file"
        />
      </label>
      <p className={styles.uploadHint}>{busy ? "Загрузка..." : hint}</p>
      {uploadError ? (
        <p className={styles.fieldError} role="alert">
          {uploadError}
        </p>
      ) : null}
      <FieldError id={describedBy}>{error}</FieldError>
    </div>
  );
}
