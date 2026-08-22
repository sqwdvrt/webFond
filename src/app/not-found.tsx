import Link from "next/link";
export const metadata = { title: "Страница не найдена", robots: { index: false, follow: true } };
export default function NotFound() { return <section className="page-hero"><div className="container page-hero-inner"><span className="eyebrow">Ошибка 404</span><h1>Страница не найдена</h1><p>Проверьте адрес или вернитесь к видам деятельности фонда.</p><div className="hero-actions"><Link className="button button-primary" href="/projects">Виды деятельности</Link></div></div></section>; }
