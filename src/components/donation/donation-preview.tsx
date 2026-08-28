const amounts = ["300 ₽", "500 ₽", "1 000 ₽", "3 000 ₽", "5 000 ₽"];

export function DonationPreview() {
  return (
    <section className="donation-preview" aria-labelledby="donation-preview-title">
      <div className="status-note">
        <strong id="donation-preview-title">Онлайн-оплата через СБП находится в подключении.</strong>
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
        Оплатить онлайн
      </button>
      <p className="preview-note">Принимаются разовые пожертвования.</p>
    </section>
  );
}
