import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MediaUrlField } from "./media-url-field";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function renderImageField(value = "") {
  return render(
    <MediaUrlField
      accept="image/jpeg,image/png,image/webp"
      describedBy="imageUrl-error"
      hint="Можно вставить ссылку или загрузить JPEG, PNG, WebP."
      id="imageUrl"
      kind="image"
      label="Изображение"
      name="imageUrl"
      uploadLabel="Загрузить изображение"
      value={value}
    />,
  );
}

function renderDocumentField(value = "") {
  return render(
    <MediaUrlField
      accept="application/pdf"
      describedBy="fileUrl-error"
      hint="Можно вставить ссылку или загрузить PDF."
      id="fileUrl"
      kind="document"
      label="Ссылка на документ"
      name="fileUrl"
      uploadLabel="Загрузить документ"
      value={value}
    />,
  );
}

describe("MediaUrlField", () => {
  it("renders its initial URL", () => {
    renderImageField("/images/projects/current.jpg");

    expect(screen.getByLabelText("Изображение")).toHaveValue(
      "/images/projects/current.jpg",
    );
  });

  it("allows manual URL editing", async () => {
    const user = userEvent.setup();
    renderImageField("/images/projects/current.jpg");

    const urlInput = screen.getByLabelText("Изображение");
    await user.clear(urlInput);
    await user.type(urlInput, "https://cdn.example.org/replacement.jpg");

    expect(urlInput).toHaveValue("https://cdn.example.org/replacement.jpg");
  });

  it("replaces the URL after a successful image upload", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ url: "/uploads/project.jpg" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock;
    renderImageField("/images/projects/current.jpg");

    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "project.jpg", {
      type: "image/jpeg",
    });
    await user.upload(screen.getByLabelText("Загрузить изображение"), file);

    await waitFor(() =>
      expect(screen.getByLabelText("Изображение")).toHaveValue(
        "/uploads/project.jpg",
      ),
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/uploads",
      expect.objectContaining({ method: "POST" }),
    );
    const body = fetchMock.mock.calls[0]?.[1]?.body;
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("kind")).toBe("image");
    expect((body as FormData).get("file")).toBe(file);
  });

  it("preserves the typed URL and shows a neutral error after a failed document upload", async () => {
    const user = userEvent.setup();
    globalThis.fetch = vi.fn(async () => {
      throw new Error("database connection secret");
    });
    renderDocumentField();

    const urlInput = screen.getByLabelText("Ссылка на документ");
    await user.type(urlInput, "/documents/manual.pdf");
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "report.pdf", {
      type: "application/pdf",
    });
    await user.upload(screen.getByLabelText("Загрузить документ"), file);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Не получилось загрузить файл. Вставьте ссылку.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(/database|secret/i);
    expect(urlInput).toHaveValue("/documents/manual.pdf");
  });

  it("shows busy text and disables the file input while an upload is pending", async () => {
    const user = userEvent.setup();
    let resolveUpload!: (response: Response) => void;
    globalThis.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveUpload = resolve;
        }),
    );
    renderDocumentField();

    const fileInput = screen.getByLabelText("Загрузить документ");
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "report.pdf", {
      type: "application/pdf",
    });
    await user.upload(fileInput, file);

    expect(fileInput).toBeDisabled();
    expect(screen.getByText("Загрузка...")).toBeVisible();

    resolveUpload(
      new Response(JSON.stringify({ url: "/uploads/report.pdf" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await waitFor(() => expect(fileInput).toBeEnabled());
  });
});
