"use client";

import Image from "next/image";
import { useState } from "react";

import { CopyRequisitesButton } from "@/components/requisites/copy-button";
import {
  bankQrDetails,
  bankQrOptions,
  formatBankQrCopy,
  type BankQrId,
} from "@/content/bank-qr";

export function BankQrTransfer({
  showRequisitesLink = true,
}: { showRequisitesLink?: boolean }) {
  const [selectedId, setSelectedId] = useState<BankQrId | null>(null);
  const selected = bankQrOptions.find((item) => item.id === selectedId) ?? null;

  return (
    <section className="bank-qr-transfer">
      <fieldset>
        <legend>Банковский счёт фонда</legend>
        <div className="bank-qr-grid">
          {bankQrOptions.map((option) => (
            <label key={option.id}>
              <input
                type="radio"
                name="bank-qr"
                checked={selectedId === option.id}
                onChange={() => setSelectedId(option.id)}
              />
              <span><i className={`bank-qr-mark bank-qr-mark-${option.id}`} aria-hidden="true">{option.label.slice(0, 1)}</i>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {selected ? (
        <div className="bank-qr-details">
          <figure className="bank-qr-code">
            <Image
              alt={selected.alt}
              height={240}
              src={selected.src}
              width={240}
              // Keep the original QR pixels; Timeweb has no image optimizer.
              unoptimized
            />
            <figcaption>
              <a download={`qr-${selected.id}.png`} href={selected.src}>
                Сохранить QR
              </a>
            </figcaption>
            <p className="bank-qr-instruction">Наведите камеру телефона на код или сохраните его и откройте в приложении банка.</p>
          </figure>
          <div className="bank-qr-account">
            <h3>Выбранный счёт фонда: {selected.label}</h3>
            <CopyRequisitesButton
              key={selected.id}
              text={formatBankQrCopy(selected)}
              label={`Скопировать реквизиты ${selected.label}`}
              successMessage={`Реквизиты ${selected.label} скопированы.`}
            />
            <dl className="bank-qr-requisites">
              {bankQrDetails(selected).map(([term, value]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>

          </div>
        </div>
      ) : (
        <div className="bank-qr-placeholder">
          <div><strong>Выберите счёт фонда, чтобы показать QR-код и реквизиты</strong>
          <p>С компьютера отсканируйте код телефоном. С телефона сохраните изображение и откройте его в приложении банка.</p></div>
        </div>
      )}

      {showRequisitesLink ? <a className="bank-qr-other" href="/requisites">Все реквизиты фонда</a> : null}
      <div className="bank-qr-notes">
        <p className="preview-note">
          Перевод по QR является пожертвованием на уставную деятельность и принятием{" "}
          <a href="/donation-offer">оферты</a>.
        </p>
      </div>
    </section>
  );
}
