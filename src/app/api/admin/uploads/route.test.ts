import { describe, expect, it, vi } from "vitest";

import { handleAdminUpload } from "./route";

const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd8]);

function formBody(init: { kind?: string; file?: File | null } = {}) {
  const body = new FormData();
  if (init.kind !== "") {
    body.set("kind", init.kind ?? "image");
  }
  if (init.file !== null) {
    body.set(
      "file",
      init.file ?? new File([jpegBytes], "photo.jpg", { type: "image/jpeg" }),
    );
  }
  return body;
}

function request(origin: string | null = "https://example.org") {
  const headers = new Headers();
  if (origin !== null) {
    headers.set("Origin", origin);
  }

  return new Request("https://example.org/api/admin/uploads", {
    method: "POST",
    headers,
  });
}

describe("handleAdminUpload", () => {
  it("rejects a missing origin", async () => {
    const response = await handleAdminUpload(request(null), {
      getSession: async () => ({ username: "op" }),
      store: vi.fn(),
    });

    expect(response.status).toBe(403);
  });

  it("rejects a guest", async () => {
    const response = await handleAdminUpload(request(), {
      getSession: async () => null,
      store: vi.fn(),
    });

    expect(response.status).toBe(401);
  });

  it("stores a valid image and returns its URL", async () => {
    const store = vi.fn(async () => ({ url: "/uploads/image/a.jpg" }));
    const response = await handleAdminUpload(request(), {
      getSession: async () => ({ username: "op" }),
      store,
      readFormData: async () => formBody(),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ url: "/uploads/image/a.jpg" });
    expect(store).toHaveBeenCalledOnce();
  });
});
