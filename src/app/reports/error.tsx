"use client";

export default function ReportsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;

  return (
    <section className="page-section">
      <div className="container route-error" role="alert">
        <h2>Не удалось загрузить отчеты</h2>
        <p>Попробуйте загрузить страницу еще раз.</p>
        <button className="button button-secondary" type="button" onClick={reset}>
          Повторить
        </button>
      </div>
    </section>
  );
}
