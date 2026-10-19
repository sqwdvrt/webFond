import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublicationControls } from "./publication-controls";

describe("PublicationControls", () => {
  it.each([
    ["DRAFT", "Сохранить черновик", "DRAFT"],
    ["DRAFT", "Опубликовать", "PUBLISHED"],
    ["PUBLISHED", "Сохранить изменения", "PUBLISHED"],
    ["PUBLISHED", "В архив", "ARCHIVED"],
    ["ARCHIVED", "В черновик", "DRAFT"],
  ])("submits %s via %s as the parser-compatible status %s", (status, label, expected) => {
    const submit = vi.fn();
    render(<form onSubmit={(event) => {
      event.preventDefault();
      submit(new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter));
    }}><PublicationControls status={status} uploading={false} /></form>);
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(submit.mock.calls[0][0].getAll("status")).toEqual([expected]);
  });

  it("disables every save action while uploading and explains publication requirements", () => {
    render(<PublicationControls status="DRAFT" uploading missing={["содержание (от 20 символов)"]} />);
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    expect(screen.getByText(/Для публикации заполните/)).toHaveTextContent("содержание");
  });
});
