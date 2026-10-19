"use client";

import { useState } from "react";
import { PublishedCard, PublishedDetail } from "@/components/content/published-content";
import styles from "./editorial.module.css";
import { mediaPreviewUrl } from "@/features/content-admin/media-preview-url";

export function EditorialPreview({ values }: { values: Record<string, string> }) {
  const [wide, setWide] = useState(false);
  const imageUrl = mediaPreviewUrl(values.imageUrl);
  return <details className={styles.previewDisclosure}>
    <summary>Предпросмотр</summary>
    <div className={styles.preview}>
      <div className={styles.actions}>
        <button type="button" aria-pressed={!wide} onClick={() => setWide(false)}>Узкая область</button>
        <button type="button" aria-pressed={wide} onClick={() => setWide(true)}>Широкая область</button>
      </div>
      <div className={wide ? styles.wide : styles.narrow} onClick={(event) => { if ((event.target as Element).closest("a")) event.preventDefault(); }}>
        <PublishedCard href="#editorial-preview" title={values.title || "Без названия"} summary={values.summary || null} imageUrl={imageUrl} publishedAt={null} />
        <h2>{values.title || "Без названия"}</h2>
        <PublishedDetail title={values.title || "Без названия"} content={values.content || ""} imageUrl={imageUrl} publishedAt={null} />
      </div>
    </div>
  </details>;
}
