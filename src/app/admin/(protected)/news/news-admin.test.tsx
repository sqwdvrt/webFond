import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentFormState } from "@/features/content-admin/mutations";
import type {
  AdminEditorialListRow,
  AdminEditorialRow,
} from "@/features/content-admin/repository";

const actionState = vi.hoisted(() => ({
  state: { status: "idle", message: "" } as ContentFormState,
  deleteState: { status: "idle", message: "" } as ContentFormState,
  deleteAction: undefined as unknown,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: (
      action: (state: ContentFormState, formData: FormData) => Promise<ContentFormState>,
    ) => {
      const initial = action === actionState.deleteAction
        ? actionState.deleteState
        : actionState.state;
      const [state, setState] = actual.useState(initial);
      const dispatch = async (formData: FormData) => {
        setState(await action(state, formData));
      };
      return [state, dispatch, false];
    },
  };
});

import { NewsForm } from "./news-form";
import { renderNewsEditPage } from "./[id]/page";
import { renderNewNewsPage } from "./new/page";
import { renderNewsPage } from "./page";

const updatedAt = new Date("2026-08-23T10:30:00.000Z");

const newsPost: AdminEditorialRow = {
  id: "news-1",
  title: "Фонд открыл новый центр",
  slug: "fond-otkryl-novyy-tsentr",
  summary: "Краткое описание события",
  content: "Подробный материал о событии и участниках.",
  imageUrl: "/images/news/new-center.jpg",
  status: "DRAFT",
  publishedAt: null,
  updatedAt,
};

const listRow: AdminEditorialListRow = {
  id: newsPost.id,
  title: newsPost.title,
  slug: newsPost.slug,
  status: newsPost.status,
  publishedAt: newsPost.publishedAt,
  updatedAt: newsPost.updatedAt,
};

function dependencies(overrides: Record<string, unknown> = {}) {
  const events: string[] = [];
  return {
    events,
    requireSession: vi.fn(async () => {
      events.push("session");
    }),
    listNews: vi.fn(async () => {
      events.push("list");
      return { items: [listRow], total: 1, page: 1, pageSize: 25, totalPages: 1 };
    }),
    getNews: vi.fn(async () => {
      events.push("get");
      return newsPost;
    }),
    showNotFound: vi.fn((): never => {
      throw new Error("not-found");
    }),
    ...overrides,
  };
}

describe("news admin pages", () => {
  beforeEach(() => {
    actionState.state = { status: "idle", message: "" };
    actionState.deleteState = { status: "idle", message: "" };
    actionState.deleteAction = undefined;
  });

  it("passes validated filters to the paginated reader and retains the corrected page in editor links", async () => {
    const deps = dependencies({
      listNews: vi.fn(async () => ({ items: [{ ...listRow, status: "PUBLISHED" as const }], total: 26, page: 2, pageSize: 25, totalPages: 2 })),
    });
    render(await renderNewsPage({ q: "  Помощь  ", status: "PUBLISHED", page: "99", sort: "updated-asc" }, deps));
    expect(deps.listNews).toHaveBeenCalledWith({ q: "Помощь", status: "PUBLISHED", page: 99, sort: "updated-asc" });
    const edit = screen.getByRole("link", { name: `Редактировать ${listRow.title}` });
    const returnTo = new URL(edit.getAttribute("href")!, "https://example.org").searchParams.get("returnTo")!;
    expect(new URL(returnTo, "https://example.org").pathname).toBe("/admin/news");
    expect(new URL(returnTo, "https://example.org").searchParams.get("page")).toBe("2");
    const create = screen.getByRole("link", { name: /Создать/ });
    expect(new URL(create.getAttribute("href")!, "https://example.org").searchParams.get("returnTo")).toBe(returnTo);
    expect(screen.queryByRole("link", { name: "Следующая страница" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Открыть на сайте: " + listRow.title })).toHaveAttribute("href", `/news/${newsPost.slug}`);
  });

  it("normalizes hostile URL parameters before reading", async () => {
    const deps = dependencies();
    render(await renderNewsPage({ status: "bad", sort: "random", page: "-2", q: ["one", "two"] }, deps));
    expect(deps.listNews).toHaveBeenCalledWith({ q: "", status: "", page: 1, sort: "updated-desc" });
  });

  it("shows a distinct empty search state", async () => {
    const deps = dependencies({
      listNews: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 })),
    });
    render(await renderNewsPage({ q: "Не существует" }, deps));
    expect(screen.getByText("По вашему запросу ничего не найдено")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("authenticates before listing news and renders create and edit links", async () => {
    const deps = dependencies();

    render(await renderNewsPage({}, deps));

    expect(deps.events).toEqual(["session", "list"]);
    expect(screen.getByRole("heading", { name: "Новости" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Создать новость" })).toHaveAttribute(
      "href",
      "/admin/news/new",
    );
    expect(screen.getByRole("link", { name: `Редактировать ${newsPost.title}` })).toHaveAttribute(
      "href",
      `/admin/news/${newsPost.id}`,
    );
    expect(screen.getByText("Черновик")).toBeVisible();
  });

  it("renders the news empty state after authentication", async () => {
    const deps = dependencies({
      listNews: vi.fn(async () => {
        deps.events.push("list");
        return { items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 };
      }),
    });

    render(await renderNewsPage({}, deps));

    expect(deps.events).toEqual(["session", "list"]);
    expect(screen.getByText("Новостей пока нет")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("authenticates the new page without reading the repository", async () => {
    const deps = dependencies();

    render(await renderNewNewsPage(deps));

    expect(deps.events).toEqual(["session"]);
    expect(deps.listNews).not.toHaveBeenCalled();
    expect(deps.getNews).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Новая новость" })).toBeVisible();
  });

  it("authenticates before lookup and awaits an actual resolved params Promise", async () => {
    const deps = dependencies();
    const params = Promise.resolve({ id: newsPost.id });

    render(await renderNewsEditPage(params, { success: "saved" }, deps));

    expect(deps.events).toEqual(["session", "get"]);
    expect(deps.getNews).toHaveBeenCalledWith(newsPost.id);
    expect(screen.getByRole("heading", { name: "Редактирование новости" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Новость сохранена");
  });

  it("does not read any page repository when authentication rejects", async () => {
    const denied = new Error("guest denied");

    for (const run of [
      (deps: ReturnType<typeof dependencies>) => renderNewsPage({}, deps),
      (deps: ReturnType<typeof dependencies>) => renderNewNewsPage(deps),
      (deps: ReturnType<typeof dependencies>) =>
        renderNewsEditPage(Promise.resolve({ id: newsPost.id }), {}, deps),
    ]) {
      const deps = dependencies({
        requireSession: vi.fn(async () => {
          deps.events.push("session");
          throw denied;
        }),
      });

      await expect(run(deps)).rejects.toBe(denied);
      expect(deps.events).toEqual(["session"]);
      expect(deps.listNews).not.toHaveBeenCalled();
      expect(deps.getNews).not.toHaveBeenCalled();
    }
  });

  it("calls notFound when the requested news post is missing", async () => {
    const deps = dependencies({
      getNews: vi.fn(async () => {
        deps.events.push("get");
        return null;
      }),
    });

    await expect(
      renderNewsEditPage(Promise.resolve({ id: "missing" }), {}, deps),
    ).rejects.toThrow("not-found");
    expect(deps.events).toEqual(["session", "get"]);
    expect(deps.showNotFound).toHaveBeenCalledOnce();
  });
});

describe("NewsForm", () => {
  const saveAction = vi.fn<
    (state: ContentFormState, formData: FormData) => Promise<ContentFormState>
  >(async () => ({ status: "idle", message: "" }));
  const deleteAction = vi.fn<
    (state: ContentFormState, formData: FormData) => Promise<ContentFormState>
  >(async () => ({ status: "idle", message: "" }));

  beforeEach(() => {
    actionState.state = { status: "idle", message: "" };
    actionState.deleteState = { status: "idle", message: "" };
    actionState.deleteAction = deleteAction;
    saveAction.mockClear();
    deleteAction.mockClear();
  });

  it("renders every field, initial values, Russian status labels and the hidden update token", () => {
    render(
      <NewsForm
        deleteAction={deleteAction}
        initialValues={newsPost}
        mode="edit"
        saveAction={saveAction}
      />,
    );

    expect(screen.getByLabelText("Заголовок")).toHaveValue(newsPost.title);
    expect(screen.getByLabelText("Адрес страницы")).toHaveValue(newsPost.slug);
    expect(screen.getByLabelText("Краткое описание")).toHaveValue(newsPost.summary);
    expect(screen.getByLabelText("Содержание")).toHaveValue(newsPost.content);
    expect(screen.getByLabelText("Изображение")).toHaveValue(newsPost.imageUrl);
    expect(screen.getByRole("button", { name: "Сохранить черновик" })).toHaveAttribute("value", "DRAFT");
    expect(screen.getByRole("button", { name: "Опубликовать" })).toHaveAttribute("name", "status");
    expect(document.querySelector('input[name="updatedAt"]')).toHaveValue(
      updatedAt.toISOString(),
    );
  });

  it("preserves submitted values and exposes validation errors", () => {
    actionState.state = {
      status: "error",
      message: "Проверьте заполнение формы",
      errors: { title: "Введите заголовок", slug: "Используйте латиницу" },
      values: {
        title: "x",
        slug: "Неверный адрес",
        summary: "Отправленное описание",
        content: "Отправленный материал",
        imageUrl: "/submitted-news.jpg",
        status: "ARCHIVED",
      },
    };

    render(<NewsForm mode="create" saveAction={saveAction} />);

    expect(screen.getByLabelText("Заголовок")).toHaveValue("x");
    expect(screen.getByLabelText("Адрес страницы")).toHaveValue("Неверный адрес");
    expect(screen.getByLabelText("Краткое описание")).toHaveValue("Отправленное описание");
    expect(screen.getByLabelText("Содержание")).toHaveValue("Отправленный материал");
    expect(screen.getByLabelText("Изображение")).toHaveValue("/submitted-news.jpg");
    expect(screen.getByRole("button", { name: "Сохранить черновик" })).toBeVisible();
    expect(screen.getByText("Введите заголовок")).toHaveAttribute("role", "alert");
    expect(screen.getByText("Используйте латиницу")).toHaveAttribute("role", "alert");
    expect(screen.getByText("Проверьте заполнение формы")).toHaveAttribute("role", "alert");
  });

  it("renders success feedback", () => {
    render(
      <NewsForm
        initialValues={newsPost}
        mode="edit"
        saveAction={saveAction}
        successMessage="Новость создана"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Новость создана");
  });

  it("offers deletion only for a never-published draft and sends the update token", () => {
    render(
      <NewsForm
        deleteAction={deleteAction}
        initialValues={newsPost}
        mode="edit"
        saveAction={saveAction}
      />,
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);

    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));

    expect(deleteAction).toHaveBeenCalledOnce();
    const submitted = deleteAction.mock.calls[0]?.[1];
    expect(submitted).toBeInstanceOf(FormData);
    expect(submitted?.get("updatedAt")).toBe(updatedAt.toISOString());
  });

  it("displays a delete action error without replacing save feedback", async () => {
    deleteAction.mockResolvedValueOnce({
      status: "error",
      message: "Удаление недоступно. Обновите страницу и повторите действие",
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <NewsForm
        deleteAction={deleteAction}
        initialValues={newsPost}
        mode="edit"
        saveAction={saveAction}
        successMessage="Новость сохранена"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));

    expect(await screen.findByRole("alert", { name: "Ошибка удаления" })).toHaveTextContent(
      "Удаление недоступно. Обновите страницу и повторите действие",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Новость сохранена");
    expect(screen.queryByRole("alert", { name: "Ошибка сохранения" })).not.toBeInTheDocument();
  });

  it.each([
    { ...newsPost, status: "PUBLISHED" as const },
    { ...newsPost, publishedAt: new Date("2026-08-22T09:00:00.000Z") },
  ])("does not offer deletion for an ineligible news post", (initialValues) => {
    render(
      <NewsForm
        deleteAction={deleteAction}
        initialValues={initialValues}
        mode="edit"
        saveAction={saveAction}
      />,
    );

    expect(screen.queryByRole("button", { name: "Удалить" })).not.toBeInTheDocument();
  });
});
