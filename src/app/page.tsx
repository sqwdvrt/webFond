import Image from "next/image";
import Link from "next/link";

import { siteConfig } from "@/config/site";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">Благотворительный фонд</span>
            <h1>{siteConfig.name}</h1>
            <p className="hero-lead">
              Помогаем людям, оказавшимся в трудной жизненной ситуации, и
              объединяем тех, кто готов поддержать добрые дела.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href={siteConfig.helpHref}>
                Сделать пожертвование
              </Link>
              <Link className="button button-secondary" href="/about">
                О фонде
              </Link>
            </div>
            <p className="hero-note">
              Разовое пожертвование через СБП. Без подписки и автосписаний.
            </p>
          </div>

          <div className="hero-logo">
            <Image
              src="/brand/logo.jpg"
              width={1254}
              height={1254}
              priority
              alt="Логотип фонда «Быть Добру»: руки, росток и лист"
            />
          </div>
        </div>
      </section>

      <section className="mission-band">
        <div className="container mission-grid">
          <span className="section-number">01 · Миссия</span>
          <div className="mission-copy">
            <h2>Поддержка, забота и устойчивый рост добрых дел</h2>
            <p>
              Фонд создан для помощи социально незащищенным гражданам и
              людям, которые нуждаются в поддержке. Деятельность строится на
              принципах гуманизма, взаимопомощи и уважения.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
