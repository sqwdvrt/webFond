import axe from "axe-core";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const formStatus = vi.hoisted(() => ({ pending: false }));

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    useFormStatus: () => ({
      action: null,
      data: null,
      method: null,
      pending: formStatus.pending,
    }),
  };
});

import {
  ContentList,
  DeleteDraftButton,
  FieldError,
  FormSuccess,
  PublicationStatusBadge,
  SubmitButton,
} from "./content-ui";

describe("shared content admin UI", () => {
  beforeEach(() => {
    formStatus.pending = false;
    vi.restoreAllMocks();
  });

  it("renders an accessible compact populated list with text status labels", async () => {
    const { container } = render(
      <ContentList
        caption="Проекты фонда"
        emptyMessage="Проектов пока нет"
        items={[
          {
            id: "project-1",
            title: "Помощь семьям",
            status: "PUBLISHED",
            updatedAt: "23.08.2026, 12:30",
            editHref: "/admin/projects/project-1",
          },
          {
            id: "project-2",
            title: "Новый проект",
            status: "DRAFT",
            updatedAt: "22.08.2026, 09:15",
            editHref: "/admin/projects/project-2",
          },
        ]}
      />,
    );

    expect(screen.getByRole("table", { name: "Проекты фонда" })).toBeVisible();
    expect(screen.getByText("Опубликован")).toBeVisible();
    expect(screen.getByText("Черновик")).toBeVisible();
    expect(screen.getByRole("link", { name: "Редактировать Помощь семьям" })).toHaveAttribute(
      "href",
      "/admin/projects/project-1",
    );

    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(
      results.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      ),
    ).toEqual([]);
  });

  it("renders an accessible empty list state", async () => {
    const { container } = render(
      <ContentList
        caption="Новости фонда"
        emptyMessage="Новостей пока нет"
        items={[]}
      />,
    );

    expect(screen.getByText("Новостей пока нет")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(
      results.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      ),
    ).toEqual([]);
  });

  it("exposes field errors, success status and every publication label", () => {
    const { rerender } = render(
      <>
        <FieldError id="title-error">Введите заголовок</FieldError>
        <FormSuccess>Материал сохранен</FormSuccess>
        <PublicationStatusBadge status="DRAFT" />
        <PublicationStatusBadge status="PUBLISHED" />
        <PublicationStatusBadge status="ARCHIVED" />
      </>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Введите заголовок");
    expect(screen.getByRole("status")).toHaveTextContent("Материал сохранен");
    expect(screen.getByText("Черновик")).toBeVisible();
    expect(screen.getByText("Опубликован")).toBeVisible();
    expect(screen.getByText("В архиве")).toBeVisible();

    formStatus.pending = true;
    rerender(<SubmitButton pendingLabel="Сохранение...">Сохранить</SubmitButton>);
    expect(screen.getByRole("button", { name: "Сохранение..." })).toBeDisabled();
  });

  it("asks for confirmation only for a never-published draft", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const action = vi.fn(async () => undefined);
    const { rerender } = render(
      <DeleteDraftButton
        action={action}
        publishedAt={null}
        status="DRAFT"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));
    expect(confirm).toHaveBeenCalledWith(
      "Удалить черновик без возможности восстановления?",
    );
    expect(action).not.toHaveBeenCalled();

    rerender(
      <DeleteDraftButton
        action={action}
        publishedAt="2026-08-23T09:00:00.000Z"
        status="DRAFT"
      />,
    );
    expect(screen.queryByRole("button", { name: "Удалить" })).not.toBeInTheDocument();

    rerender(
      <DeleteDraftButton action={action} publishedAt={null} status="PUBLISHED" />,
    );
    expect(screen.queryByRole("button", { name: "Удалить" })).not.toBeInTheDocument();
  });
});
