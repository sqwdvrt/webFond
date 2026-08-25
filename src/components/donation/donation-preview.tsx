const amounts = ["300 ₽", "500 ₽", "1 000 ₽", "3 000 ₽", "5 000 ₽"];

export function DonationPreview() {
  return (
    <section className="donation-preview" aria-labelledby="donation-preview-title">
      <div className="status-note">
        <strong id="donation-preview-title">Онлайн-оплата подключается.</strong>{" "}
        Платежи на сайте пока недоступны.
      </div>
      <label className="donation-offer donation-offer-first">
        <input type="checkbox" disabled />
        <span>
          Я даю{" "}
          <a href="/personal-data-consent">
            согласие на обработку персональных данных
          </a>{" "}
          и ознакомился с{" "}
          <a href="/privacy">
            Политикой Фонда в отношении обработки персональных данных
          </a>
          .
        </span>
      </label>
      <fieldset disabled>
        <legend>Сумма разового пожертвования</legend>
        <div className="amount-grid">
          {amounts.map((amount) => (
            <label key={amount}>
              <input type="radio" name="amount" />
              <span>{amount}</span>
            </label>
          ))}
        </div>
        <label className="other-amount">
          <span>Другая сумма</span>
          <input type="number" inputMode="numeric" min="1" />
        </label>
      </fieldset>
      <button className="button button-muted" type="button" disabled>
        Онлайн-оплата скоро будет доступна
      </button>
      <p className="preview-note">Только разовый платеж. Без подписки и автосписаний.</p>
    </section>
  );
}
