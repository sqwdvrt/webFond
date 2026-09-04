import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";

import { DonationForm } from "./donation-form";
import { PAYMENT_ATTEMPT_STORAGE_KEY } from "@/features/payments/attempt-storage";

const ATTEMPT_ID = "f04d0001-0000-4000-8000-000000000001";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key) {
      return data.get(key) ?? null;
    },
    key(index) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key) {
      data.delete(key);
    },
    setItem(key, value) {
      data.set(key, value);
    },
  };
}

function renderForm(
  overrides: {
    fetchImpl?: typeof fetch;
    storage?: Storage;
    assign?: (url: string) => void;
  } = {},
) {
  const storage = overrides.storage ?? memoryStorage();
  const assign = overrides.assign ?? vi.fn();
  const fetchImpl =
    overrides.fetchImpl ??
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          redirectUrl: "https://yoomoney.ru/checkout/payment",
          donationId: "donation-local",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

  render(
    <DonationForm
      fetchImpl={fetchImpl}
      storage={storage}
      randomUUID={() => ATTEMPT_ID}
      now={() => new Date("2026-08-24T18:00:00.000Z")}
      assign={assign}
    />,
  );

  return { assign, fetchImpl, storage };
}

describe("DonationForm", () => {
  it("places personal data consent before the amount and requires both consents", async () => {
    const user = userEvent.setup();
    const { fetchImpl } = renderForm();
    const consent = screen.getByRole("checkbox", {
      name: /согласие на обработку персональных данных/i,
    });
    const amountLegend = screen.getByText("Сумма разового пожертвования");

    expect(consent.compareDocumentPosition(amountLegend) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(
      screen.getByRole("link", {
        name: "согласие на обработку персональных данных",
      }),
    ).toHaveAttribute("href", "/personal-data-consent");
    expect(
      screen.getByRole("link", {
        name: "Политикой Фонда в отношении обработки персональных данных",
      }),
    ).toHaveAttribute("href", "/privacy");

    await user.click(screen.getByRole("button", { name: "Оплатить онлайн" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/согласи|оферт|сумм/i);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Оплата проходит на стороне ЮKassa. Можно выбрать Систему быстрых платежей (СБП) или банковскую карту. При СБП подтвердите платёж в приложении банка. Пожертвование разовое, без подписки и автоматических списаний.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Оплатить онлайн" })).toBeVisible();
  });

  it("submits a valid payment payload without name or email", async () => {
    const user = userEvent.setup();
    const { assign, fetchImpl, storage } = renderForm();

    await user.click(screen.getByLabelText("1 000 ₽"));
    await user.click(
      screen.getByRole("checkbox", {
        name: /согласие на обработку персональных данных/i,
      }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: /оферту пожертвования/i }),
    );
    await user.click(screen.getByRole("button", { name: "Оплатить онлайн" }));

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce());
    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const payload = JSON.parse(String(init.body));
    expect(payload).toEqual({
      amountRoubles: 1000,
      acceptedOffer: true,
      acceptedPersonalData: true,
      attemptId: ATTEMPT_ID,
      website: "",
    });
    expect(payload).not.toHaveProperty("name");
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("phone");
    expect(payload).not.toHaveProperty("receipt");
    expect(screen.queryByLabelText(/имя/i)).toBeNull();
    expect(screen.queryByLabelText(/email/i)).toBeNull();
    expect(screen.getByRole("link", { name: /оферту пожертвования/i })).toHaveAttribute(
      "href",
      "/donation-offer",
    );
    expect(assign).toHaveBeenCalledExactlyOnceWith(
      "https://yoomoney.ru/checkout/payment",
    );
    expect(JSON.parse(storage.getItem(PAYMENT_ATTEMPT_STORAGE_KEY) ?? "{}")).toMatchObject({
      donationId: "donation-local",
    });
  });

  it("requires the offer and a valid custom amount", async () => {
    const user = userEvent.setup();
    const { fetchImpl } = renderForm();

    await user.type(screen.getByLabelText("Другая сумма"), "50");
    await user.click(screen.getByRole("button", { name: "Оплатить онлайн" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/оферт|сумм/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("shows a server error and retries the same attempt", async () => {
    const user = userEvent.setup();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "provider_unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            redirectUrl: "https://yoomoney.ru/checkout/payment",
            donationId: "donation-local",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    renderForm({ fetchImpl });

    await user.click(screen.getByLabelText("500 ₽"));
    await user.click(
      screen.getByRole("checkbox", {
        name: /согласие на обработку персональных данных/i,
      }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: /оферту пожертвования/i }),
    );
    await user.click(screen.getByRole("button", { name: "Оплатить онлайн" }));
    expect(await screen.findByRole("alert")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Оплатить онлайн" }));
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    const first = JSON.parse(String(fetchImpl.mock.calls[0]![1].body));
    const second = JSON.parse(String(fetchImpl.mock.calls[1]![1].body));
    expect(first.attemptId).toBe(ATTEMPT_ID);
    expect(second.attemptId).toBe(ATTEMPT_ID);
  });

  it("hides the honeypot from assistive technology", () => {
    renderForm();
    const honeypot = screen.getByRole("textbox", { name: "Сайт", hidden: true });
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot).toHaveAttribute("autocomplete", "off");
  });

  it("has no serious accessibility violations", async () => {
    const { container } = render(
      <main>
        <h1>Помочь фонду</h1>
        <DonationForm
          fetchImpl={vi.fn()}
          storage={memoryStorage()}
          randomUUID={() => ATTEMPT_ID}
          now={() => new Date("2026-08-24T18:00:00.000Z")}
          assign={vi.fn()}
        />
      </main>,
    );
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    const violations = results.violations.filter(
      (item) => item.impact === "serious" || item.impact === "critical",
    );
    expect(violations).toEqual([]);
  });
});
