"use client";

import { useState } from "react";

import { CopyRequisitesButton } from "@/components/requisites/copy-button";
import {
  bankQrDetails,
  bankQrOptions,
  formatBankQrCopy,
  type BankQrId,
} from "@/content/bank-qr";

export function BankQrTransfer() {
  const [selectedId, setSelectedId] = useState<BankQrId | null>(null);
  const selected = bankQrOptions.find((item) => item.id === selectedId) ?? null;

  return (
    <section className="bank-qr-transfer">
      <fieldset>
        <legend>Банк</legend>
        <div className="bank-qr-grid">
          {bankQrOptions.map((option) => (
            <label key={option.id}>
              <input
                type="radio"
                name="bank-qr"
                checked={selectedId === option.id}
                onChange={() => setSelectedId(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {selected ? (
        <div className="bank-qr-details">
          <figure className="bank-qr-code">
            <img
              alt={selected.alt}
              height={240}
              src={selected.src}
              width={240}
            />
            <figcaption>
              <a download={`qr-${selected.id}.png`} href={selected.src}>
                Сохранить QR
              </a>
            </figcaption>
          </figure>
          <div className="bank-qr-account">
            <dl className="bank-qr-requisites">
              {bankQrDetails(selected).map(([term, value]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <CopyRequisitesButton text={formatBankQrCopy(selected)} />
          </div>
        </div>
      ) : (
        <p className="bank-qr-placeholder">
          Выберите банк, чтобы показать QR-код и реквизиты
        </p>
      )}

      <p className="preview-note">
        С компьютера отсканируйте код телефоном. С телефона сохраните изображение
        и откройте его в приложении банка.
      </p>
      <p className="preview-note">
        Это перевод по реквизитам фонда, не оплата через Систему быстрых платежей
        (СБП).
      </p>
      <p className="preview-note">
        Перевод по QR является пожертвованием на уставную деятельность и принятием{" "}
        <a href="/donation-offer">оферты</a>.
      </p>
    </section>
  );
}
