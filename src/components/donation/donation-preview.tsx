import { siteConfig } from "@/config/site";

export function DonationPreview() {
  return (
    <section className="donation-preview" aria-labelledby="donation-preview-title">
      <div className="status-note">
        <h2 id="donation-preview-title">Онлайн-пожертвования скоро будут доступны</h2>
        <p>
          Мы не показываем форму оплаты, пока платежный сценарий не подключен. Так меньше риска
          отправить человека в тупик.
        </p>
      </div>
      <p>
        Пока фонд можно поддержать по банковским реквизитам или написать нам. QR-код будет опубликован
        после подтверждения банковских реквизитов.
      </p>
      <p className="quiet-row">
        <a href="/requisites">Посмотреть реквизиты</a>
        <a href={`mailto:${siteConfig.legal.emailLabel}`}>Написать на почту</a>
      </p>
    </section>
  );
}
