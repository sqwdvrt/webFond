// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { handleAdminUpload } from "./route";
import { ImageProcessingBusyError } from "@/features/uploads/prepare-image";

const jpegBytes = await sharp({ create: { width: 8, height: 4, channels: 3, background: "red" } }).jpeg().toBuffer();

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
  it("asks callers to retry when image decoding capacity is full", async () => {
    const response = await handleAdminUpload(request(), {
      getSession: async () => ({}), readFormData: async () => formBody(),
      store: async () => { throw new ImageProcessingBusyError(); },
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("1");
    expect(await response.json()).toMatchObject({ error: "busy" });
  });
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

it.each([undefined, "10"])("bounds streamed multipart bytes with content-length %s", async (length) => {
  const headers = new Headers({ Origin: "https://example.org", "Content-Type": "multipart/form-data; boundary=test" });
  if (length) headers.set("Content-Length", length);
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(100_000)); },
    cancel() { cancelled = true; },
  });
  const streamed = new Request("https://example.org/api/admin/uploads", { method: "POST", headers, body, duplex: "half" } as RequestInit);
  const readFormData = vi.fn(async () => formBody());
  const response = await handleAdminUpload(streamed, { getSession: async () => ({}), store: vi.fn(), readFormData });
  expect(response.status).toBe(413);
  expect(cancelled).toBe(true);
  expect(readFormData).not.toHaveBeenCalled();
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});

it("parses actual multipart data and rejects an oversized file before arrayBuffer", async () => {
  const body = formBody({ file: new File([new Uint8Array(4_000_001)], "big.jpg", { type: "image/jpeg" }) });
  const store = vi.fn();
  const response = await handleAdminUpload(new Request("https://example.org/api/admin/uploads", { method: "POST", headers: { Origin: "https://example.org" }, body }), { getSession: async () => ({}), store });
  expect(response.status).toBe(413);
  expect(store).not.toHaveBeenCalled();
});

it("accepts actual multipart image data", async () => {
  const store = vi.fn(async () => ({ url: "/uploads/image/old.jpg" }));
  const response = await handleAdminUpload(new Request("https://example.org/api/admin/uploads", { method: "POST", headers: { Origin: "https://example.org" }, body: formBody() }), { getSession: async () => ({}), store });
  expect(response.status).toBe(200);
  expect(store).toHaveBeenCalledOnce();
});

it("does not read unauthorized bodies", async () => {
  const current = request();
  const getReader = vi.fn();
  Object.defineProperty(current, "body", { value: { getReader } });
  expect((await handleAdminUpload(current, { getSession: async () => null, store: vi.fn() })).status).toBe(401);
  expect(getReader).not.toHaveBeenCalled();
});

it("returns invalid for malformed multipart", async () => {
  const response = await handleAdminUpload(new Request("https://example.org/api/admin/uploads", { method: "POST", headers: { Origin: "https://example.org", "Content-Type": "multipart/form-data; boundary=missing" }, body: "broken" }), { getSession: async () => ({}), store: vi.fn() });
  expect(response.status).toBe(400);
});

it("checks file size before allocating its arrayBuffer", async () => {
  const file = new File([jpegBytes], "photo.jpg");
  Object.defineProperty(file, "size", { value: 4_000_001 });
  const arrayBuffer = vi.spyOn(file, "arrayBuffer");
  const form = { get: (key: string) => key === "kind" ? "image" : file } as unknown as FormData;
  const response = await handleAdminUpload(request(), { getSession: async () => ({}), store: vi.fn(), readFormData: async () => form });
  expect(response.status).toBe(413);
  expect(arrayBuffer).not.toHaveBeenCalled();
});
