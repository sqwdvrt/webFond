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

  it("writes to the object store when it is configured", async () => {
    const putObject = vi.fn(async () => ({
      url: "https://files.timeweb.example/uploads/image/a.jpg",
    }));

    const stored = await storeUpload(
      { bytes: new Uint8Array([0xff, 0xd8, 0xff]), detected: jpeg, kind: "image" },
      {
        isProduction: true,
        objectStore: {
          endpoint: "https://s3.example",
          region: "ru-1",
          bucket: "fond-uploads",
          accessKey: "key",
          secretKey: "secret",
          publicBaseUrl: "https://files.timeweb.example",
        },
        putObject,
      },
    );

    expect(putObject).toHaveBeenCalledOnce();
    expect(putObject.mock.calls[0]?.[0]).toMatchObject({
      pathname: expect.stringMatching(/^uploads\/image\/.+\.jpg$/),
      contentType: "image/jpeg",
    });
    expect(stored.url).toBe("https://files.timeweb.example/uploads/image/a.jpg");
  });

  it("fails closed in production without object or blob storage", async () => {
    await expect(
      storeUpload(
        { bytes: new Uint8Array([0xff, 0xd8, 0xff]), detected: jpeg, kind: "image" },
        { isProduction: true, onVercel: false },
      ),
    ).rejects.toBeInstanceOf(UploadStorageUnavailableError);
  });
});
