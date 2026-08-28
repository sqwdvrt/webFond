import Link from "next/link";

export const metadata = { title: "Страница не найдена", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <section className="page-hero">
      <div className="container page-hero-inner">
        <span className="eyebrow">Ошибка 404</span>
        <h1>Такой страницы нет</h1>
        <p>Проверьте адрес или вернитесь на главную.</p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/">
            На главную
          </Link>
        </div>
      </div>
    </section>
  );
}
