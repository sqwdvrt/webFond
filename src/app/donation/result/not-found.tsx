import Link from "next/link";

export default function DonationResultNotFound() {
  return (
    <section className="page-hero">
      <div className="container page-hero-inner">
        <span className="eyebrow">Пожертвование</span>
        <h1>Результат не найден</h1>
        <p>Не удалось найти этот платёж. Вернитесь на страницу помощи фонду.</p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/help">
            К пожертвованию
          </Link>
        </div>
      </div>
    </section>
  );
}
