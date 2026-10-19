import type { Metadata } from "next";

import { ContactForm } from "@/components/contact/contact-form";
import { PageHero } from "@/components/content/page-hero";
import { siteConfig } from "@/config/site";

import { submitContactAction } from "./actions";

export const metadata: Metadata = {
  title: "Контакты",
  description: "Контактные данные фонда «Быть Добру».",
  alternates: { canonical: "/contacts" },
};

export default function ContactsPage() {
  return (
    <>
      <PageHero eyebrow="Контакты" title="Написать нам" />
      <section className="page-section" id="help-request">
        <div className="container contact-layout">
          <ContactForm action={submitContactAction} />
          <aside className="contact-details" aria-label="Способы связи с фондом">
            <div>
              <h2>Электронная почта</h2>
              <a href={`mailto:${siteConfig.legal.email}`}>{siteConfig.legal.emailLabel}</a>
              <p>Для обращений по деятельности фонда, поддержке и документам.</p>
            </div>
            <div>
              <h2>Как с нами связаться</h2>
              {siteConfig.contacts.phones.map((phone) => (
                <a key={phone.href} href={phone.href}>{phone.label}</a>
              ))}
            </div>
            <div>
              <h2>Адрес</h2>
              <address>{siteConfig.legal.address}</address>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
