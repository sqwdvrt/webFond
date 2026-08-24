import axe from "axe-core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ContentFormState } from "@/features/content-admin/mutations";
import type { AdminRequisitesResult } from "@/features/content-admin/repository";
import { defaultRequisitesDraft } from "@/features/content-admin/validation";

import { renderRequisitesPage } from "./page";
import { RequisitesForm } from "./requisites-form";

const updatedAt = new Date("2026-08-23T09:00:00.000Z");
const defaults = defaultRequisitesDraft();
const savedValues = {
  ...defaults,
  status: "PUBLISHED" as const,
  bankName: "АО Банк Добра",
  recipientName: "БФ БЫТЬ ДОБРУ",
  checkingAccount: "40703810000000000001",
  correspondentAccount: "30101810000000000002",
  bik: "044525999",
};

function dependencies(
  result: AdminRequisitesResult = {
    status: "missing",
    value: defaults,
    updatedAt: null,
  },
) {
  const events: string[] = [];
  return {
    events,
    requireSession: vi.fn(async () => {
      events.push("session");
    }),
    getRequisites: vi.fn(async () => {
      events.push("get");
      return result;
    }),
  };
}

const idleAction = vi.fn<
  (state: ContentFormState, formData: FormData) => Promise<ContentFormState>
>(async () => ({ status: "idle", message: "" }));

describe("requisites admin page", () => {
  it("authenticates before reading fallback requisites", async () => {
    const deps = dependencies();

    render(await renderRequisitesPage({}, deps));

    expect(deps.events).toEqual(["session", "get"]);
    expect(screen.getByRole("heading", { name: "Реквизиты" })).toBeVisible();
    expect(screen.getByLabelText("Полное наименование")).toHaveValue(defaults.fullName);
    expect(document.querySelector('input[name="updatedAt"]')).not.toBeInTheDocument();
  });

  it("does not read requisites when authentication rejects", async () => {
    const deps = dependencies();
    const denied = new Error("guest denied");
    deps.requireSession.mockRejectedValueOnce(denied);

    await expect(renderRequisitesPage({}, deps)).rejects.toBe(denied);

    expect(deps.events).toEqual([]);
    expect(deps.getRequisites).not.toHaveBeenCalled();
  });

  it("propagates database rejection to the protected error boundary", async () => {
    const deps = dependencies();
    const databaseError = new Error("database unavailable");
    deps.getRequisites.mockImplementationOnce(async () => {
      deps.events.push("get");
      throw databaseError;
    });

    await expect(renderRequisitesPage({}, deps)).rejects.toBe(databaseError);
    expect(deps.events).toEqual(["session", "get"]);
  });

  it("renders success feedback from the redirect query", async () => {
    const deps = dependencies({ status: "ok", value: savedValues, updatedAt });

    render(await renderRequisitesPage({ success: "saved" }, deps));

    expect(screen.getByRole("status")).toHaveTextContent("Реквизиты сохранены");
  });
});

describe("RequisitesForm", () => {
  it("renders every legal and bank field, status and update token", () => {
    render(
      <RequisitesForm
        replaceAction={idleAction}
        requisites={{ status: "ok", value: savedValues, updatedAt }}
        saveAction={idleAction}
      />,
    );

    const expected = [
      ["Полное наименование", savedValues.fullName],
      ["Краткое наименование", savedValues.shortName],
      ["ОГРН", savedValues.ogrn],
      ["ИНН", savedValues.inn],
      ["КПП", savedValues.kpp],
      ["Юридический адрес", savedValues.address],
      ["Email", savedValues.email],
      ["Наименование банка", savedValues.bankName],
      ["Получатель", savedValues.recipientName],
      ["Расчетный счет", savedValues.checkingAccount],
      ["Корреспондентский счет", savedValues.correspondentAccount],
      ["БИК", savedValues.bik],
    ] as const;

    for (const [label, value] of expected) {
      expect(screen.getByLabelText(label)).toHaveValue(value);
    }
    expect(screen.getByLabelText("Статус")).toHaveValue("PUBLISHED");
    expect(screen.getByRole("option", { name: "Черновик" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Опубликован" })).toBeVisible();
    expect(screen.getByRole("option", { name: "В архиве" })).toBeVisible();
    expect(document.querySelector('input[name="version"]')).toHaveValue("1");
    expect(document.querySelector('input[name="updatedAt"]')).toHaveValue(
      updatedAt.toISOString(),
    );
    expect(screen.queryByRole("button", { name: "Удалить" })).not.toBeInTheDocument();
  });

  it("submits initial fallback creation without an optimistic token", async () => {
    const saveAction = vi.fn<
      (state: ContentFormState, formData: FormData) => Promise<ContentFormState>
    >(async () => ({ status: "error", message: "Проверьте заполнение формы" }));
    render(
      <RequisitesForm
        replaceAction={idleAction}
        requisites={{ status: "missing", value: defaults, updatedAt: null }}
        saveAction={saveAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(saveAction).toHaveBeenCalledOnce());
    expect(saveAction.mock.calls[0]?.[1].has("updatedAt")).toBe(false);
  });

  it("preserves all submitted edits through the real React action-state contract", async () => {
    const user = userEvent.setup();
    const edits = {
      fullName: "Благотворительный фонд Новый день",
      shortName: "БФ Новый день",
      ogrn: "1234567890123",
      inn: "1234567890",
      kpp: "123456789",
      address: "Москва, улица Добра, дом 1",
      email: "office@example.org",
      bankName: "Новый банк",
      recipientName: "БФ Новый день",
      checkingAccount: "40703810000000000003",
      correspondentAccount: "30101810000000000004",
      bik: "044525123",
      status: "ARCHIVED",
    } as const;
    const labels = {
      fullName: "Полное наименование",
      shortName: "Краткое наименование",
      ogrn: "ОГРН",
      inn: "ИНН",
      kpp: "КПП",
      address: "Юридический адрес",
      email: "Email",
      bankName: "Наименование банка",
      recipientName: "Получатель",
      checkingAccount: "Расчетный счет",
      correspondentAccount: "Корреспондентский счет",
      bik: "БИК",
      status: "Статус",
    } as const;
    const saveAction = vi.fn(async (
      _state: ContentFormState,
      formData: FormData,
    ): Promise<ContentFormState> => ({
      status: "error",
      message: "Не удалось сохранить. Проверьте данные и повторите попытку",
      errors: { inn: "Проверьте ИНН" },
      values: Object.fromEntries(
        [...formData.entries()].map(([name, value]) => [name, String(value)]),
      ),
    }));

    render(
      <RequisitesForm
        replaceAction={idleAction}
        requisites={{ status: "missing", value: defaults, updatedAt: null }}
        saveAction={saveAction}
      />,
    );

    for (const [name, value] of Object.entries(edits)) {
      const control = screen.getByLabelText(labels[name as keyof typeof labels]);
      if (name === "status") {
        await user.selectOptions(control, value);
      } else {
        await user.clear(control);
        await user.type(control, value);
      }
    }
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByRole("alert", { name: "Ошибка сохранения" })).toBeVisible();
    for (const [name, value] of Object.entries(edits)) {
      expect(screen.getByLabelText(labels[name as keyof typeof labels])).toHaveValue(value);
    }
  });

  it("does not render malformed JSON values and replaces them only after confirmation", async () => {
    const replaceAction = vi.fn<
      (state: ContentFormState, formData: FormData) => Promise<ContentFormState>
    >(async () => ({
      status: "error",
      message: "Не удалось заменить данные. Обновите страницу и повторите попытку",
    }));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <RequisitesForm
        replaceAction={replaceAction}
        requisites={{ status: "invalid", updatedAt }}
        saveAction={idleAction}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Сохраненные реквизиты повреждены и не могут быть показаны",
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/malformed|Prisma|database|JSON/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Заменить безопасным черновиком" }));

    await waitFor(() => expect(replaceAction).toHaveBeenCalledOnce());
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(replaceAction.mock.calls[0]?.[1].get("updatedAt")).toBe(updatedAt.toISOString());
    expect(await screen.findByRole("alert", { name: "Ошибка замены" })).toHaveTextContent(
      "Не удалось заменить данные",
    );
  });

  it("cancels malformed requisites replacement without invoking the action", () => {
    const replaceAction = vi.fn(async (): Promise<ContentFormState> => ({
      status: "idle",
      message: "",
    }));
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <RequisitesForm
        replaceAction={replaceAction}
        requisites={{ status: "invalid", updatedAt }}
        saveAction={idleAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Заменить безопасным черновиком" }));

    expect(replaceAction).not.toHaveBeenCalled();
  });

  it("keeps validation errors neutral and accessible", async () => {
    const saveAction = vi.fn(async (): Promise<ContentFormState> => ({
      status: "error",
      message: "Проверьте заполнение формы",
      errors: { inn: "Введите ИНН из 10 цифр" },
      values: { ...defaults, inn: "secret-database-value" },
    }));
    const { container } = render(
      <RequisitesForm
        replaceAction={idleAction}
        requisites={{ status: "missing", value: defaults, updatedAt: null }}
        saveAction={saveAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByText("Введите ИНН из 10 цифр")).toHaveAttribute("role", "alert");
    expect(screen.getByLabelText("ИНН")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(/secret|Prisma|database|stack/i)).not.toBeInTheDocument();
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);
  });
});
