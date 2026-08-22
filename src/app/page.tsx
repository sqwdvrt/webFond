import { Building2, HandHeart, HeartHandshake, Megaphone } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { EmptyState } from "@/components/content/empty-state";
import { SectionHeading } from "@/components/content/section-heading";
import { projects } from "@/content/projects";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Помогаем быть рядом", description: siteConfig.description, alternates: { canonical: "/" } };

const participation = [
  { title: "Поддержать фонд", text: "Информация о способах поддержки готовится к публикации.", icon: HandHeart, href: "/help" },
  { title: "Волонтерство", text: "Информация о волонтерской программе готовится к публикации.", icon: HeartHandshake },
  { title: "Партнерство", text: "Информация для партнеров готовится к публикации.", icon: Building2 },
  { title: "Информационная поддержка", text: "Проверенные материалы для публикации появятся на сайте позже.", icon: Megaphone },
];

export default function HomePage() {
  return <>
    <section className="hero"><div className="container hero-grid"><div><span className="eyebrow">Благотворительный фонд</span><h1>{siteConfig.name}</h1><p className="hero-lead">Помогаем людям, оказавшимся в трудной жизненной ситуации, и объединяем тех, кто готов поддержать добрые дела.</p><div className="hero-actions"><Link className="button button-primary" href="/help">Помочь фонду</Link><Link className="button button-secondary" href={siteConfig.routes.contactsForHelp}>Нужна помощь?</Link></div></div><div className="hero-logo"><Image src="/brand/logo.jpg" width={1254} height={1254} priority alt="Логотип фонда «Быть Добру»: руки, росток и лист" /></div></div></section>
    <section className="content-band"><div className="container"><SectionHeading number="01" title="Цели, предмет и виды деятельности фонда" /><span className="project-status">Виды деятельности по уставу</span><p className="activity-intro">Фонд помогает людям, которым особенно нужна поддержка, и объединяет необходимые для этого усилия и средства.</p><ul className="activity-list" role="list">{projects.map((project) => <li key={project.description}>{project.homepageDescription}</li>)}</ul><p className="activity-note">Конкретные программы и проекты будут опубликованы после их утверждения фондом.</p></div></section>
    <section className="content-band surface-band"><div className="container"><SectionHeading number="02" title="Как можно помочь" intro="Мы готовим понятные способы участия и публикуем только подтвержденную информацию." /><div className="participation-grid">{participation.map(({ title, text, icon: Icon, href }) => <article className="participation-item" key={title}><Icon aria-hidden="true" size={28} strokeWidth={1.6} /><h3>{title}</h3><p>{text}</p>{href ? <Link href={href}>Узнать подробнее</Link> : null}</article>)}</div></div></section>
    <section className="content-band"><div className="container split-states"><div><span className="section-number">03 Новости</span><EmptyState title="Материалы готовятся к публикации" description="Новости появятся после проверки и утверждения." /></div><div><span className="section-number">04 Отчеты</span><EmptyState title="Проверенные отчеты появятся здесь" description="Документы будут опубликованы после проверки." /></div></div></section>
    <section className="contact-band"><div className="container contact-band-inner"><div><span className="eyebrow">Остались вопросы?</span><h2>Свяжитесь с фондом</h2><p>Расскажем о видах деятельности и доступных способах участия.</p></div><Link className="button button-light" href="/contacts">Контакты фонда</Link></div></section>
  </>;
}
