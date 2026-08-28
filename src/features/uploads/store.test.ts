import { describe, expect, it, vi } from "vitest";

import { storeUpload, UploadStorageUnavailableError } from "./store";

const jpeg = {
  kind: "image" as const,
  extension: "jpg",
  contentType: "image/jpeg",
};

describe("storeUpload", () => {
  it("writes to blob storage when a token is present", async () => {
    const putBlob = vi.fn(async () => ({
      url: "https://files.example.org/uploads/image/a.jpg",
    }));

    const stored = await storeUpload(
      { bytes: new Uint8Array([0xff, 0xd8, 0xff]), detected: jpeg, kind: "image" },
      { blobToken: "blob-token", putBlob: putBlob as never },
    );

    expect(putBlob).toHaveBeenCalledOnce();
    expect(stored.url).toBe("https://files.example.org/uploads/image/a.jpg");
  });

  it("writes locally when blob storage is not configured", async () => {
    const writeLocal = vi.fn(async () => undefined);

    const stored = await storeUpload(
      { bytes: new Uint8Array([0xff, 0xd8, 0xff]), detected: jpeg, kind: "image" },
      { cwd: "/tmp/site", onVercel: false, writeLocal },
    );

    expect(writeLocal).toHaveBeenCalledOnce();
    expect(stored.url).toMatch(/^\/uploads\/image\/.+\.jpg$/);
  });

  it("fails closed on Vercel without blob storage", async () => {
    await expect(
      storeUpload(
        { bytes: new Uint8Array([0xff, 0xd8, 0xff]), detected: jpeg, kind: "image" },
        { onVercel: true },
      ),
    ).rejects.toBeInstanceOf(UploadStorageUnavailableError);
  });
});
