export function reconciliationMessage(code?: string | null, manualReviewRequired = false) {
  const messages: Record<string, string> = {
    payment_amount_mismatch: "Сумма не совпадает",
    payment_currency_mismatch: "Валюта не совпадает",
    payment_metadata_mismatch: "Платёж связан с другой записью",
    payment_method_mismatch: "Способ оплаты ранее не распознан. Повторите проверку после обновления сайта",
    payment_provider_protocol: "Не удалось проверить ответ ЮKassa. Повторите проверку; при повторении нужна диагностика",
    payment_provider_unavailable: "ЮKassa временно недоступна",
    payment_provider_configuration: "Проверьте настройки подключения ЮKassa",
    payment_provider_pending: "Ожидается завершение оплаты",
    payment_terminal_state_conflict: "Статусы расходятся: нужен ручной разбор",
    payment_database_unavailable: "Не удалось сохранить результат проверки",
    manual_review_required: "Лимит автоматических проверок исчерпан",
  };
  return code ? messages[code] ?? "Не удалось подтвердить платёж" : manualReviewRequired ? "Нужна ручная проверка" : "";
}
