const amounts = ["300 ₽", "500 ₽", "1 000 ₽", "3 000 ₽", "5 000 ₽"];

export function DonationPreview() {
  return <section className="donation-preview" aria-labelledby="donation-preview-title"><div className="status-note"><strong id="donation-preview-title">СБП подключается.</strong>{" "}Платежи на сайте пока недоступны.</div><fieldset disabled><legend>Сумма разового пожертвования</legend><div className="amount-grid">{amounts.map((amount) => <label key={amount}><input type="radio" name="amount" /><span>{amount}</span></label>)}</div><label className="other-amount"><span>Другая сумма</span><input type="number" inputMode="numeric" min="1" /></label></fieldset><p className="button button-muted" aria-disabled="true">Онлайн-оплата скоро будет доступна</p><p className="preview-note">Только разовый платеж. Без подписки и автосписаний.</p></section>;
}
