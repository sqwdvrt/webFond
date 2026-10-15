import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";

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
        <div className="container contact-details">
          <div>
            <Mail aria-hidden="true" />
            <h2>Электронная почта</h2>
            <a href={`mailto:${siteConfig.legal.emailLabel}`}>
              {siteConfig.legal.emailLabel}
            </a>
            <p>Для обращений по деятельности фонда, поддержке и документам.</p>
          </div>
          <div>
            <MapPin aria-hidden="true" />
            <h2>Адрес</h2>
            <address>{siteConfig.legal.address}</address>
          </div>
          <div>
            <Phone aria-hidden="true" />
            <h2>Как с нами связаться</h2>
            <a href="tel:+79287147783">8 928 714 77 83</a>
            <br />
            <a href="tel:+79287157783">8 928 715 77 83</a>
          </div>
        </div>
        <div className="container">
          <ContactForm action={submitContactAction} />
        </div>
      </section>
    </>
  );
}
