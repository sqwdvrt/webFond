import Link from "next/link";

import { siteConfig } from "@/config/site";

const legalLinks = [
  { href: "/privacy", label: "Политика конфиденциальности" },
  { href: "/personal-data-consent", label: "Согласие на обработку данных" },
  { href: "/donation-offer", label: "Оферта пожертвования" },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-intro">
          <Link className="footer-brand" href="/">
            {siteConfig.name}
          </Link>
          <p>{siteConfig.tagline}</p>
        </div>

        <div>
          <h2>Контакты</h2>
          <address>
            <a href={`mailto:${siteConfig.legal.email}`}>
              {siteConfig.legal.email}
            </a>
            <span>{siteConfig.legal.address}</span>
          </address>
        </div>

        <div>
          <h2>Документы</h2>
          <ul className="footer-links">
            {legalLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="container footer-bottom">
        <p>
          ОГРН {siteConfig.legal.ogrn} · ИНН {siteConfig.legal.inn} · КПП{" "}
          {siteConfig.legal.kpp}
        </p>
        <p>© {new Date().getFullYear()} {siteConfig.name}</p>
      </div>
    </footer>
  );
}
