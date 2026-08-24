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

import { ProjectForm } from "./project-form";
import { renderProjectEditPage } from "./[id]/page";
import { renderNewProjectPage } from "./new/page";
import { renderProjectsPage } from "./page";

const updatedAt = new Date("2026-08-23T09:00:00.000Z");

const project: AdminEditorialRow = {
  id: "project-1",
  title: "Помощь семьям",
  slug: "pomoshch-semyam",
  summary: "Краткое описание проекта",
  content: "Подробное описание проекта и его результатов.",
  imageUrl: "/images/projects/families.jpg",
  status: "DRAFT",
  publishedAt: null,
  updatedAt,
};

const listRow: AdminEditorialListRow = {
  id: project.id,
  title: project.title,
  slug: project.slug,
  status: project.status,
  publishedAt: project.publishedAt,
  updatedAt: project.updatedAt,
};

function dependencies(overrides: Record<string, unknown> = {}) {
  const events: string[] = [];
  return {
    events,
    requireSession: vi.fn(async () => {
      events.push("session");
    }),
    listProjects: vi.fn(async () => {
      events.push("list");
      return [listRow];
    }),
    getProject: vi.fn(async () => {
      events.push("get");
      return project;
    }),
    showNotFound: vi.fn((): never => {
      throw new Error("not-found");
    }),
    ...overrides,
  };
}

describe("projects admin pages", () => {
  beforeEach(() => {
    actionState.state = { status: "idle", message: "" };
  });

  it("authenticates before listing projects and renders create and edit links", async () => {
    const deps = dependencies();

    render(await renderProjectsPage({}, deps));

    expect(deps.events).toEqual(["session", "list"]);
    expect(screen.getByRole("heading", { name: "Проекты" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Создать проект" })).toHaveAttribute(
      "href",
      "/admin/projects/new",
    );
    expect(screen.getByRole("link", { name: `Редактировать ${project.title}` })).toHaveAttribute(
      "href",
      `/admin/projects/${project.id}`,
    );
    expect(screen.getByText("Черновик")).toBeVisible();
  });

  it("renders the projects empty state after authentication", async () => {
    const deps = dependencies({
      listProjects: vi.fn(async () => {
        deps.events.push("list");
        return [];
      }),
    });

    render(await renderProjectsPage({}, deps));

    expect(deps.events).toEqual(["session", "list"]);
    expect(screen.getByText("Проектов пока нет")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("authenticates the new page without reading the repository", async () => {
    const deps = dependencies();

    render(await renderNewProjectPage(deps));

    expect(deps.events).toEqual(["session"]);
    expect(deps.listProjects).not.toHaveBeenCalled();
    expect(deps.getProject).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Новый проект" })).toBeVisible();
  });

  it("authenticates before lookup and awaits an actual resolved params Promise", async () => {
    const deps = dependencies();
    const params = Promise.resolve({ id: project.id });

    render(await renderProjectEditPage(params, { success: "saved" }, deps));

    expect(deps.events).toEqual(["session", "get"]);
    expect(deps.getProject).toHaveBeenCalledWith(project.id);
    expect(screen.getByRole("heading", { name: "Редактирование проекта" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Проект сохранен");
  });

  it("does not read any page repository when authentication rejects", async () => {
    const denied = new Error("guest denied");

    for (const run of [
      (deps: ReturnType<typeof dependencies>) => renderProjectsPage({}, deps),
      (deps: ReturnType<typeof dependencies>) => renderNewProjectPage(deps),
      (deps: ReturnType<typeof dependencies>) =>
        renderProjectEditPage(Promise.resolve({ id: project.id }), {}, deps),
    ]) {
      const deps = dependencies({
        requireSession: vi.fn(async () => {
          deps.events.push("session");
          throw denied;
        }),
      });

      await expect(run(deps)).rejects.toBe(denied);
      expect(deps.events).toEqual(["session"]);
      expect(deps.listProjects).not.toHaveBeenCalled();
      expect(deps.getProject).not.toHaveBeenCalled();
    }
  });

  it("calls notFound when the requested project is missing", async () => {
    const deps = dependencies({
      getProject: vi.fn(async () => {
        deps.events.push("get");
        return null;
      }),
    });

    await expect(
      renderProjectEditPage(Promise.resolve({ id: "missing" }), {}, deps),
    ).rejects.toThrow("not-found");
    expect(deps.events).toEqual(["session", "get"]);
    expect(deps.showNotFound).toHaveBeenCalledOnce();
  });
});

describe("ProjectForm", () => {
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
      <ProjectForm
        deleteAction={deleteAction}
        initialValues={project}
        mode="edit"
        saveAction={saveAction}
      />,
    );

    expect(screen.getByLabelText("Название")).toHaveValue(project.title);
    expect(screen.getByLabelText("Адрес страницы")).toHaveValue(project.slug);
    expect(screen.getByLabelText("Краткое описание")).toHaveValue(project.summary);
    expect(screen.getByLabelText("Содержание")).toHaveValue(project.content);
    expect(screen.getByLabelText("Изображение")).toHaveValue(project.imageUrl);
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
      errors: { title: "Введите название", slug: "Используйте латиницу" },
      values: {
        title: "x",
        slug: "Неверный адрес",
        summary: "Отправленное описание",
        content: "Отправленный текст",
        imageUrl: "/submitted.jpg",
        status: "ARCHIVED",
      },
    };

    render(<ProjectForm mode="create" saveAction={saveAction} />);

    expect(screen.getByLabelText("Название")).toHaveValue("x");
    expect(screen.getByLabelText("Адрес страницы")).toHaveValue("Неверный адрес");
    expect(screen.getByLabelText("Краткое описание")).toHaveValue("Отправленное описание");
    expect(screen.getByLabelText("Содержание")).toHaveValue("Отправленный текст");
    expect(screen.getByLabelText("Изображение")).toHaveValue("/submitted.jpg");
    expect(screen.getByLabelText("Статус")).toHaveValue("ARCHIVED");
    expect(screen.getByText("Введите название")).toHaveAttribute("role", "alert");
    expect(screen.getByText("Используйте латиницу")).toHaveAttribute("role", "alert");
    expect(screen.getByText("Проверьте заполнение формы")).toHaveAttribute("role", "alert");
  });

  it("renders success feedback", () => {
    render(
      <ProjectForm
        initialValues={project}
        mode="edit"
        saveAction={saveAction}
        successMessage="Проект создан"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Проект создан");
  });

  it("offers deletion only for a never-published draft and sends the update token", async () => {
    render(
      <ProjectForm
        deleteAction={deleteAction}
        initialValues={project}
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
    { ...project, status: "PUBLISHED" as const },
    { ...project, publishedAt: new Date("2026-08-22T09:00:00.000Z") },
  ])("does not offer deletion for an ineligible $1 project", (initialValues) => {
    render(
      <ProjectForm
        deleteAction={deleteAction}
        initialValues={initialValues}
        mode="edit"
        saveAction={saveAction}
      />,
    );

    expect(screen.queryByRole("button", { name: "Удалить" })).not.toBeInTheDocument();
  });
});
