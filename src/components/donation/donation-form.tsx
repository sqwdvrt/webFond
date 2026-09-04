"use client";

import { useId, useState } from "react";

import {
  attachDonationMarker,
  beginNewPaymentAttempt,
  resolvePaymentAttempt,
  type PaymentAttemptStorageDependencies,
} from "@/features/payments/attempt-storage";
import { normalizeDonorEmail } from "@/features/payments/validation";

const PRESET_AMOUNTS = [
  { value: 300, label: "300 ₽" },
  { value: 500, label: "500 ₽" },
  { value: 1000, label: "1 000 ₽" },
  { value: 3000, label: "3 000 ₽" },
  { value: 5000, label: "5 000 ₽" },
] as const;

const ERROR_MESSAGES: Record<string, string> = {
  invalid_request: "Проверьте сумму, согласие на обработку данных и принятие оферты.",
  stale_attempt:
    "Предыдущая попытка оплаты устарела. Подтвердите новый платеж.",
  conflict: "Эта попытка оплаты уже использована с другой суммой.",
  rate_limited: "Слишком много попыток. Подождите и повторите.",
  provider_rejected: "Платеж не принят. Попробуйте другую сумму.",
  configuration_unavailable: "Онлайн-оплата временно недоступна.",
  provider_endpoint_error: "Платежный сервис временно недоступен.",
  provider_unavailable: "Платежный сервис временно недоступен.",
  provider_protocol: "Не удалось начать оплату. Попробуйте ещё раз.",
  internal_error: "Не удалось начать оплату. Попробуйте ещё раз.",
};

function readSelectedAmount(
  selectedPreset: number | "other",
  otherAmount: string,
): number | null {
  if (selectedPreset !== "other") {
    return selectedPreset;
  }
  const parsed = Number.parseInt(otherAmount, 10);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 100 ||
    parsed > 100_000 ||
    String(parsed) !== otherAmount.trim()
  ) {
    return null;
  }
  return parsed;
}

export type DonationFormProps = {
  fetchImpl?: typeof fetch;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  randomUUID?: () => string;
  now?: () => Date;
  assign?: (url: string) => void;
};

export function DonationForm({
  fetchImpl = fetch,
  storage,
  randomUUID = () => crypto.randomUUID(),
  now = () => new Date(),
  assign = (url) => {
    window.location.assign(url);
  },
}: DonationFormProps) {
  const headingId = useId();
  const errorId = useId();
  const [selectedPreset, setSelectedPreset] = useState<number | "other">(300);
  const [otherAmount, setOtherAmount] = useState("");
  const [email, setEmail] = useState("");
  const [acceptedOffer, setAcceptedOffer] = useState(false);
  const [acceptedPersonalData, setAcceptedPersonalData] = useState(false);
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsNewAttempt, setNeedsNewAttempt] = useState(false);

  const storageDependencies = (): PaymentAttemptStorageDependencies => ({
    storage: storage ?? window.sessionStorage,
    randomUUID,
    now,
  });

  async function submit(forceNew: boolean) {
    const amountRoubles = readSelectedAmount(selectedPreset, otherAmount);
    if (amountRoubles === null) {
      setError("Укажите сумму от 100 до 100 000 рублей.");
      return;
    }
    if (!acceptedPersonalData) {
      setError(
        "Чтобы продолжить, дайте согласие на обработку персональных данных.",
      );
      return;
    }
    const donorEmail = normalizeDonorEmail(email);
    if (!donorEmail) {
      setError("Укажите email для кассового чека.");
      return;
    }
    if (!acceptedOffer) {
      setError("Чтобы продолжить, примите оферту пожертвования.");
      return;
    }

    const dependencies = storageDependencies();
    const resolved = forceNew
      ? {
          kind: "ready" as const,
          attempt: beginNewPaymentAttempt(amountRoubles, dependencies),
        }
      : resolvePaymentAttempt(amountRoubles, dependencies);

    if (resolved.kind !== "ready") {
      setNeedsNewAttempt(true);
      setError(
        resolved.kind === "stale-needs-confirmation"
          ? ERROR_MESSAGES.stale_attempt
          : "Сумма изменилась. Подтвердите новый платеж.",
      );
      return;
    }

    setPending(true);
    setError(null);
    setNeedsNewAttempt(false);

    try {
      const response = await fetchImpl("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountRoubles,
          acceptedOffer: true,
          acceptedPersonalData: true,
          attemptId: resolved.attempt.id,
          email: donorEmail,
          website,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        redirectUrl?: string;
        donationId?: string;
        error?: string;
      };

      if (!response.ok || typeof payload.redirectUrl !== "string") {
        if (payload.error === "stale_attempt" || payload.error === "conflict") {
          setNeedsNewAttempt(true);
        }
        setError(ERROR_MESSAGES[payload.error ?? "internal_error"] ?? ERROR_MESSAGES.internal_error);
        return;
      }

      if (typeof payload.donationId === "string") {
        attachDonationMarker(resolved.attempt.id, payload.donationId, dependencies);
      }
      assign(payload.redirectUrl);
    } catch {
      setError(ERROR_MESSAGES.provider_unavailable);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="donation-preview donation-form" aria-labelledby={headingId}>
      <h2 id={headingId}>Разовое пожертвование</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(false);
        }}
        noValidate
      >
        <fieldset>
          <legend>Сумма разового пожертвования</legend>
          <div className="amount-grid">
            {PRESET_AMOUNTS.map((amount) => (
              <label key={amount.value}>
                <input
                  type="radio"
                  name="amount"
                  checked={selectedPreset === amount.value}
                  onChange={() => {
                    setSelectedPreset(amount.value);
                    setOtherAmount("");
                  }}
                />
                <span>{amount.label}</span>
              </label>
            ))}
          </div>
          <label className="other-amount">
            <span>Другая сумма</span>
            <input
              type="number"
              inputMode="numeric"
              min={100}
              max={100000}
              value={otherAmount}
              onChange={(event) => {
                setSelectedPreset("other");
                setOtherAmount(event.target.value);
              }}
            />
          </label>
        </fieldset>

        <label className="other-amount">
          <span>Email для кассового чека</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <p className="preview-note">
          ЮKassa отправит кассовый чек на этот адрес.
        </p>

        <label className="donation-offer">
          <input
            type="checkbox"
            checked={acceptedPersonalData}
            onChange={(event) => setAcceptedPersonalData(event.target.checked)}
          />
          <span>
            Я даю{" "}
            <a href="/personal-data-consent">
              согласие на обработку персональных данных
            </a>{" "}
            и ознакомился с{" "}
            <a href="/privacy">
              Политикой Фонда в отношении обработки персональных данных
            </a>
            .
          </span>
        </label>

        <label className="donation-offer">
          <input
            type="checkbox"
            checked={acceptedOffer}
            onChange={(event) => setAcceptedOffer(event.target.checked)}
          />
          <span>
            Принимаю{" "}
            <a href="/donation-offer">оферту пожертвования</a>
          </span>
        </label>

        <label className="donation-honeypot">
          Сайт
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </label>

        {error ? (
          <p className="donation-error" id={errorId} role="alert">
            {error}
          </p>
        ) : null}

        <button
          className="button button-primary"
          type="submit"
          disabled={pending}
        >
          {pending ? "Создаём платёж..." : "Оплатить онлайн"}
        </button>
        {needsNewAttempt ? (
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              void submit(true);
            }}
          >
            Начать новый платеж
          </button>
        ) : null}
      </form>
      <p className="preview-note">
        Оплата проходит на стороне ЮKassa. Можно выбрать Систему быстрых платежей
        (СБП) или банковскую карту. При СБП подтвердите платёж в приложении банка.
        Пожертвование разовое, без подписки и автоматических списаний.
      </p>
    </section>
  );
}
