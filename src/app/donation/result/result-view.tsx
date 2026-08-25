import Link from "next/link";

export type DonationResultView =
  | { kind: "succeeded" }
  | { kind: "canceled" }
  | { kind: "pending" }
  | { kind: "technical-error" };

export function ResultView({ kind }: DonationResultView) {
  if (kind === "succeeded") {
    return (
      <section className="page-hero">
        <div className="container page-hero-inner">
          <span className="eyebrow">Пожертвование</span>
          <h1>Спасибо за помощь</h1>
          <p>Пожертвование получено. Фонд «Быть Добру» благодарит вас за поддержку.</p>
        </div>
      </section>
    );
  }

  if (kind === "canceled") {
    return (
      <section className="page-hero">
        <div className="container page-hero-inner">
          <span className="eyebrow">Пожертвование</span>
          <h1>Платеж не завершён</h1>
          <p>Оплата не прошла. Можно вернуться и попробовать ещё раз.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/help">
              Повторить перевод
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (kind === "pending") {
    return (
      <section className="page-hero">
        <div className="container page-hero-inner">
          <span className="eyebrow">Пожертвование</span>
          <h1>Платеж обрабатывается</h1>
          <p>Статус ещё не подтверждён. Обновите страницу через несколько секунд.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page-hero">
      <div className="container page-hero-inner">
        <span className="eyebrow">Пожертвование</span>
        <h1>Не удалось проверить платёж</h1>
        <p>Проверка у платёжного сервиса временно недоступна. Обновите страницу позже.</p>
      </div>
    </section>
  );
}
