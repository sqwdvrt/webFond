import { siteConfig } from "@/config/site";

export function DonationPreview() {
  return (
    <div className="donation-preview">
      <p className="status-note">
        Онлайн-оплата пока недоступна. Вы можете сделать пожертвование банковским переводом.
      </p>
      <p className="quiet-row">
        <a className="button button-primary" href="/requisites">Посмотреть реквизиты</a>
        <a href={`mailto:${siteConfig.legal.emailLabel}`}>Написать на почту</a>
      </p>
    </div>
  );
}
