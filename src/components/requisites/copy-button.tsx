"use client";

import { useState } from "react";

type CopyRequisitesButtonProps = {
  text: string;
  label?: string;
  successMessage?: string;
};

export function CopyRequisitesButton({
  text,
  label = "Скопировать реквизиты",
  successMessage = "Реквизиты скопированы.",
}: CopyRequisitesButtonProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setError(false);
    } catch {
      setCopied(false);
      setError(true);
    }
  }

  return (
    <div className="requisites-copy">
      <button className="button button-secondary" onClick={copy} type="button">
        {copied ? "Скопировано" : label}
      </button>
      {copied ? <p className="status-note" role="status">{successMessage}</p> : null}
      {error ? (
        <p className="status-note" role="alert">
          Не получилось скопировать. Выделите текст вручную.
        </p>
      ) : null}
    </div>
  );
}
