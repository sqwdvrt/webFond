"use client";

import { useEffect, useRef, useState } from "react";

import styles from "../admin.module.css";
import { FieldError } from "./content-ui";
import ui from "./editorial.module.css";
import { UPLOAD_MAX_BYTES } from "@/features/uploads/limits";
import { mediaPreviewUrl } from "@/features/content-admin/media-preview-url";

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
  const [metadata, setMetadata] = useState<{ name: string; size: number } | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const previewUrl = mediaPreviewUrl(url);

  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (wrapper) wrapper.dataset.uploading = String(busy);
    wrapper?.dispatchEvent(new Event("uploadstate", { bubbles: true }));
    return () => {
      if (wrapper) {
        wrapper.dataset.uploading = "false";
        wrapper.dispatchEvent(new Event("uploadstate", { bubbles: true }));
      }
    };
  }, [busy]);

  function changeUrl(next: string) {
    setUrl(next);
    setImageFailed(false);
    if (inputRef.current) {
      inputRef.current.value = next;
      inputRef.current.dispatchEvent(new Event("editorialchange", { bubbles: true }));
    }
  }

  async function onFileChange(file: File | undefined) {
    if (!file) {
      return;
    }

    const request = ++generation.current;
    if (!accept.split(",").includes(file.type) || !file.size || file.size > UPLOAD_MAX_BYTES) {
      setUploadError("Нужен файл допустимого типа размером до 4 000 000 байт.");
      setBusy(false);
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

      if (request !== generation.current) return;

      if (!response.ok || !payload.url) {
        setUploadError(
          payload.message ?? "Не получилось загрузить файл. Вставьте ссылку.",
        );
        return;
      }

      changeUrl(payload.url);
      setMetadata({ name: file.name, size: file.size });
    } catch {
      if (request === generation.current) setUploadError("Не получилось загрузить файл. Вставьте ссылку.");
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }

  return (
    <div className={styles.field} ref={wrapperRef} data-uploading={busy}>
      <label htmlFor={id}>{label}</label>
      <input
        ref={inputRef}
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        id={id}
        maxLength={2048}
        name={name}
        onChange={(event) => {
          generation.current++;
          setBusy(false);
          setMetadata(null);
          changeUrl(event.target.value);
        }}
        required={required}
        type="text"
        value={url}
      />
      {previewUrl && kind === "image" ? <>
        {imageFailed ? <p role="status">Не удалось показать изображение. Проверьте ссылку.</p> :
          // eslint-disable-next-line @next/next/no-img-element
          <img className={ui.image} src={previewUrl} alt="Предпросмотр изображения" onError={() => setImageFailed(true)} />}
      </> : null}
      {url ? <button type="button" onClick={() => {
        generation.current++;
        setBusy(false);
        setMetadata(null);
        changeUrl("");
      }}>Убрать из материала</button> : null}
      <p className={styles.uploadHint}>Очистка ссылки не удаляет файл из хранилища. Максимум {UPLOAD_MAX_BYTES.toLocaleString("ru-RU")} байт. {kind === "image" ? "JPEG, PNG, WebP." : "PDF."}</p>
      {kind === "document" && previewUrl ? <a href={previewUrl} target="_blank" rel="noopener noreferrer">Открыть документ</a> : null}
      {kind === "document" && metadata ? <p>{metadata.name} · {metadata.size.toLocaleString("ru-RU")} байт</p> : null}
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
