import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentFormState } from "@/features/content-admin/mutations";
import type {
  AdminEditorialListRow,
  AdminEditorialRow,
} from "@/features/content-admin/repository";

const actionState = vi.hoisted(() => ({
  state: { status: "idle", message: "" } as ContentFormState,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: (action: unknown) => [actionState.state, action, false],
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
      return [listRow];
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
        return [];
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
    expect(screen.getByLabelText("Статус")).toHaveValue("DRAFT");
    expect(screen.getByRole("option", { name: "Черновик" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Опубликован" })).toBeVisible();
    expect(screen.getByRole("option", { name: "В архиве" })).toBeVisible();
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
    expect(screen.getByLabelText("Статус")).toHaveValue("ARCHIVED");
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
