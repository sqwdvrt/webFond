import { Building2, HandHeart, HeartHandshake, Megaphone } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { EmptyState } from "@/components/content/empty-state";
import { ProjectCard } from "@/components/content/project-card";
import { SectionHeading } from "@/components/content/section-heading";
import { projects } from "@/content/projects";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Помогаем быть рядом", description: siteConfig.description, alternates: { canonical: "/" } };

const participation = [
  { title: "Разовое пожертвование", text: "Подключение оплаты через СБП готовится.", icon: HandHeart, href: "/help" },
  { title: "Волонтерство", text: "Информация о волонтерской программе готовится к публикации.", icon: HeartHandshake },
  { title: "Партнерство", text: "Информация для партнеров готовится к публикации.", icon: Building2 },
  { title: "Информационная поддержка", text: "Проверенные материалы для публикации появятся на сайте позже.", icon: Megaphone },
];

export default function HomePage() {
  return <>
    <section className="hero"><div className="container hero-grid"><div><span className="eyebrow">Благотворительный фонд</span><h1>{siteConfig.name}</h1><p className="hero-lead">Помогаем людям, оказавшимся в трудной жизненной ситуации, и объединяем тех, кто готов поддержать добрые дела.</p><div className="hero-actions"><Link className="button button-primary" href="/help">Сделать пожертвование</Link><Link className="button button-secondary" href={siteConfig.routes.contactsForHelp}>Нужна помощь?</Link></div><p className="hero-note">Разовое пожертвование через СБП. Без подписки и автосписаний.</p></div><div className="hero-logo"><Image src="/brand/logo.jpg" width={1254} height={1254} priority alt="Логотип фонда «Быть Добру»: руки, росток и лист" /></div></div></section>
    <section className="content-band"><div className="container"><SectionHeading number="01" title="Направления помощи" intro="Три направления работы основаны на уставных целях фонда." /><div className="project-grid">{projects.map((project) => <ProjectCard key={project.slug} project={project} />)}</div></div></section>
    <section className="content-band surface-band"><div className="container"><SectionHeading number="02" title="Как можно помочь" intro="Мы готовим понятные способы участия и публикуем только подтвержденную информацию." /><div className="participation-grid">{participation.map(({ title, text, icon: Icon, href }) => <article className="participation-item" key={title}><Icon aria-hidden="true" size={28} strokeWidth={1.6} /><h3>{title}</h3><p>{text}</p>{href ? <Link href={href}>Узнать подробнее</Link> : null}</article>)}</div></div></section>
    <section className="content-band facts-band"><div className="container facts-grid"><SectionHeading number="03" title="Подтвержденные факты" /><div className="fact-list"><p><strong>17 июля 2025 года</strong><span>дата регистрации фонда</span></p><p><strong>Москва</strong><span>место нахождения фонда</span></p><p><strong>Гуманизм, взаимопомощь, уважение</strong><span>принципы работы</span></p></div></div></section>
    <section className="content-band"><div className="container split-states"><div><span className="section-number">04 Новости</span><EmptyState title="Материалы готовятся к публикации" description="Новости появятся после проверки и утверждения." /></div><div><span className="section-number">05 Отчеты</span><EmptyState title="Проверенные отчеты появятся здесь" description="Документы будут опубликованы после проверки." /></div></div></section>
    <section className="contact-band"><div className="container contact-band-inner"><div><span className="eyebrow">Остались вопросы?</span><h2>Свяжитесь с фондом</h2><p>Расскажем о направлениях работы и доступных способах участия.</p></div><Link className="button button-light" href="/contacts">Контакты фонда</Link></div></section>
  </>;
}
