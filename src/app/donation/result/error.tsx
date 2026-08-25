"use client";

export default function DonationResultError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="page-hero">
      <div className="container page-hero-inner">
        <span className="eyebrow">Пожертвование</span>
        <h1>Не удалось открыть результат</h1>
        <p>Данные временно недоступны. Повторите запрос.</p>
        <div className="hero-actions">
          <button className="button button-primary" type="button" onClick={reset}>
            Повторить
          </button>
        </div>
      </div>
    </section>
  );
}
