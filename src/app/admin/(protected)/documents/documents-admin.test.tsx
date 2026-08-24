import axe from "axe-core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ContentFormState } from "@/features/content-admin/mutations";
import type {
  AdminDocumentListRow,
  AdminDocumentRow,
} from "@/features/content-admin/repository";

import { DocumentForm } from "./document-form";
import { renderDocumentEditPage } from "./[id]/page";
import { renderNewDocumentPage } from "./new/page";
import { renderDocumentsPage } from "./page";

const updatedAt = new Date("2026-08-23T09:00:00.000Z");

const documentRow: AdminDocumentRow = {
  id: "document-1",
  title: "Годовой отчет",
  category: "Отчеты",
  fileUrl: "/documents/annual-report.pdf",
  status: "DRAFT",
  publishedAt: null,
  updatedAt,
};

const listRow: AdminDocumentListRow = {
  id: documentRow.id,
  title: documentRow.title,
  category: documentRow.category,
  status: documentRow.status,
  publishedAt: documentRow.publishedAt,
  updatedAt: documentRow.updatedAt,
};

function dependencies(overrides: Record<string, unknown> = {}) {
  const events: string[] = [];
  return {
    events,
    requireSession: vi.fn(async () => {
      events.push("session");
    }),
    listDocuments: vi.fn(async () => {
      events.push("list");
      return [listRow];
    }),
    getDocument: vi.fn(async () => {
      events.push("get");
      return documentRow;
    }),
    showNotFound: vi.fn((): never => {
      throw new Error("not-found");
    }),
    ...overrides,
  };
}

const idleAction = vi.fn<
  (state: ContentFormState, formData: FormData) => Promise<ContentFormState>
>(async () => ({ status: "idle", message: "" }));

describe("documents admin pages", () => {
  it("authenticates before listing documents and renders create and edit links", async () => {
    const deps = dependencies();

    render(await renderDocumentsPage({}, deps));

    expect(deps.events).toEqual(["session", "list"]);
    expect(screen.getByRole("heading", { name: "Документы" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Создать документ" })).toHaveAttribute(
      "href",
      "/admin/documents/new",
    );
    expect(screen.getByRole("link", { name: `Редактировать ${documentRow.title}` })).toHaveAttribute(
      "href",
      `/admin/documents/${documentRow.id}`,
    );
    expect(screen.getByText("Черновик")).toBeVisible();
  });

  it("renders the empty state after authentication", async () => {
    const deps = dependencies({
      listDocuments: vi.fn(async () => {
        deps.events.push("list");
        return [];
      }),
    });

    render(await renderDocumentsPage({}, deps));

    expect(deps.events).toEqual(["session", "list"]);
    expect(screen.getByText("Документов пока нет")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("authenticates the create page without a repository read", async () => {
    const deps = dependencies();

    render(await renderNewDocumentPage(deps));

    expect(deps.events).toEqual(["session"]);
    expect(deps.listDocuments).not.toHaveBeenCalled();
    expect(deps.getDocument).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Новый документ" })).toBeVisible();
  });

  it("authenticates before lookup and awaits params Promise", async () => {
    const deps = dependencies();
    const params = Promise.resolve({ id: documentRow.id });

    render(await renderDocumentEditPage(params, { success: "saved" }, deps));

    expect(deps.events).toEqual(["session", "get"]);
    expect(deps.getDocument).toHaveBeenCalledWith(documentRow.id);
    expect(screen.getByRole("heading", { name: "Редактирование документа" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Документ сохранен");
  });

  it("does not read repositories when page authentication rejects", async () => {
    const denied = new Error("guest denied");

    for (const run of [
      (deps: ReturnType<typeof dependencies>) => renderDocumentsPage({}, deps),
      (deps: ReturnType<typeof dependencies>) => renderNewDocumentPage(deps),
      (deps: ReturnType<typeof dependencies>) =>
        renderDocumentEditPage(Promise.resolve({ id: documentRow.id }), {}, deps),
    ]) {
      const deps = dependencies({
        requireSession: vi.fn(async () => {
          deps.events.push("session");
          throw denied;
        }),
      });

      await expect(run(deps)).rejects.toBe(denied);
      expect(deps.events).toEqual(["session"]);
      expect(deps.listDocuments).not.toHaveBeenCalled();
      expect(deps.getDocument).not.toHaveBeenCalled();
    }
  });

  it("calls notFound for a missing document", async () => {
    const deps = dependencies({
      getDocument: vi.fn(async () => {
        deps.events.push("get");
        return null;
      }),
    });

    await expect(
      renderDocumentEditPage(Promise.resolve({ id: "missing" }), {}, deps),
    ).rejects.toThrow("not-found");
    expect(deps.events).toEqual(["session", "get"]);
    expect(deps.showNotFound).toHaveBeenCalledOnce();
  });
});

describe("DocumentForm", () => {
  it("renders all fields, status labels and the optimistic update token", () => {
    render(
      <DocumentForm
        deleteAction={idleAction}
        initialValues={documentRow}
        mode="edit"
        saveAction={idleAction}
      />,
    );

    expect(screen.getByLabelText("Название")).toHaveValue(documentRow.title);
    expect(screen.getByLabelText("Категория")).toHaveValue(documentRow.category);
    expect(screen.getByLabelText("Ссылка на документ")).toHaveValue(documentRow.fileUrl);
    expect(screen.getByLabelText("Статус")).toHaveValue("DRAFT");
    expect(screen.getByRole("option", { name: "Черновик" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Опубликован" })).toBeVisible();
    expect(screen.getByRole("option", { name: "В архиве" })).toBeVisible();
    expect(document.querySelector('input[name="updatedAt"]')).toHaveValue(
      updatedAt.toISOString(),
    );
    expect(screen.queryByText(/формат PDF/i)).not.toBeInTheDocument();
  });

  it("preserves submitted edits through the real React action-state contract", async () => {
    const user = userEvent.setup();
    const saveAction = vi.fn(async (
      _state: ContentFormState,
      formData: FormData,
    ): Promise<ContentFormState> => ({
      status: "error",
      message: "Не удалось сохранить. Проверьте данные и повторите попытку",
      errors: { title: "Введите название" },
      values: {
        title: String(formData.get("title")),
        category: String(formData.get("category")),
        fileUrl: String(formData.get("fileUrl")),
        status: String(formData.get("status")),
      },
    }));

    const { container } = render(<DocumentForm mode="create" saveAction={saveAction} />);
    await user.type(screen.getByLabelText("Название"), "Измененный отчет");
    await user.type(screen.getByLabelText("Категория"), "Финансы");
    await user.type(screen.getByLabelText("Ссылка на документ"), "/docs/edited.pdf");
    await user.selectOptions(screen.getByLabelText("Статус"), "ARCHIVED");
    await user.click(screen.getByRole("button", { name: "Создать документ" }));

    expect(await screen.findByRole("alert", { name: "Ошибка сохранения" })).toHaveTextContent(
      "Не удалось сохранить",
    );
    expect(screen.getByLabelText("Название")).toHaveValue("Измененный отчет");
    expect(screen.getByLabelText("Категория")).toHaveValue("Финансы");
    expect(screen.getByLabelText("Ссылка на документ")).toHaveValue("/docs/edited.pdf");
    expect(screen.getByLabelText("Статус")).toHaveValue("ARCHIVED");
    expect(container.querySelector('a[href*="edited.pdf"]')).not.toBeInTheDocument();
  });

  it("offers confirmed deletion only for a never-published draft and sends its token", async () => {
    const deleteAction = vi.fn<
      (state: ContentFormState, formData: FormData) => Promise<ContentFormState>
    >(async () => ({ status: "idle", message: "" }));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <DocumentForm
        deleteAction={deleteAction}
        initialValues={documentRow}
        mode="edit"
        saveAction={idleAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));

    await waitFor(() => expect(deleteAction).toHaveBeenCalledOnce());
    expect(deleteAction.mock.calls[0]?.[1].get("updatedAt")).toBe(updatedAt.toISOString());
  });

  it.each([
    { ...documentRow, status: "PUBLISHED" as const },
    { ...documentRow, publishedAt: new Date("2026-08-22T09:00:00.000Z") },
  ])("does not offer deletion for an ineligible document", (initialValues) => {
    render(
      <DocumentForm
        deleteAction={idleAction}
        initialValues={initialValues}
        mode="edit"
        saveAction={idleAction}
      />,
    );

    expect(screen.queryByRole("button", { name: "Удалить" })).not.toBeInTheDocument();
  });

  it("renders neutral errors accessibly without leaking technical details", async () => {
    const saveAction = vi.fn(async (): Promise<ContentFormState> => ({
      status: "error",
      message: "Не удалось сохранить. Проверьте данные и повторите попытку",
      errors: { fileUrl: "Введите безопасный локальный или HTTPS-адрес" },
      values: { fileUrl: "javascript:secret()" },
    }));
    const { container } = render(<DocumentForm mode="create" saveAction={saveAction} />);

    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByRole("alert", { name: "Ошибка сохранения" })).toBeVisible();
    expect(screen.getByText("Введите безопасный локальный или HTTPS-адрес")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(screen.getByLabelText("Ссылка на документ")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(/Prisma|database|stack|secret/i)).not.toBeInTheDocument();

    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);
  });
});
