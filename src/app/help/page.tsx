import type { Metadata } from "next";
import { PageHero } from "@/components/content/page-hero";
import { DonationPreview } from "@/components/donation/donation-preview";

export const metadata: Metadata = { title: "Помочь фонду", description: "Способы участия и подготовка разового пожертвования через СБП.", alternates: { canonical: "/help" } };

export default function HelpPage() {
  return <><PageHero eyebrow="Помочь фонду" title="Разовая помощь через СБП" description="Подключение оплаты через СБП готовится. Подписок, автосписаний и сохранения карты не будет." /><section className="page-section"><div className="container text-grid"><div><span className="section-number">01 Пожертвование</span></div><DonationPreview /></div></section><section className="page-section surface-band"><div className="container text-grid"><div><span className="section-number">02 Другие способы</span></div><div className="prose"><h2>Участие без платежа</h2><p>Информация о волонтерстве, партнерстве и информационной поддержке готовится к публикации.</p></div></div></section></>;
}
