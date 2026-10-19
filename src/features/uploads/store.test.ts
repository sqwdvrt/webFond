// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import type { PutObjectInput } from "./object-store";
import { storeUpload, UploadStorageUnavailableError } from "./store";

const imageBytes = await sharp({ create: { width: 20, height: 10, channels: 3, background: "red" } }).jpeg().toBuffer();

const jpeg = {
  kind: "image" as const,
  extension: "jpg",
  contentType: "image/jpeg",
};

describe("storeUpload", () => {
  it("writes to blob storage when a token is present", async () => {
    const putBlob = vi.fn<(path: string, bytes: Buffer, options: Record<string, unknown>) => Promise<{ url: string }>>(async () => ({
      url: "https://files.example.org/uploads/image/a.jpg",
    }));

    const stored = await storeUpload(
      { bytes: imageBytes, detected: jpeg, kind: "image" },
      { blobToken: "blob-token", putBlob: putBlob as never },
    );

    expect(putBlob).toHaveBeenCalledOnce();
    expect(stored.url).toBe("https://files.example.org/uploads/image/a.jpg");
    const options = putBlob.mock.calls[0]?.[2];
    expect(options).toMatchObject({ contentType: "image/webp", cacheControlMaxAge: 31536000 });
    expect((await sharp(putBlob.mock.calls[0]![1]).metadata()).format).toBe("webp");
  });

  it("writes locally when blob storage is not configured", async () => {
    const writeLocal = vi.fn<(path: string, bytes: Uint8Array) => Promise<void>>(async () => undefined);

    const stored = await storeUpload(
      { bytes: imageBytes, detected: jpeg, kind: "image" },
      { cwd: "/tmp/site", onVercel: false, writeLocal },
    );

    expect(writeLocal).toHaveBeenCalledOnce();
    expect(stored.url).toMatch(/^\/uploads\/image\/.+\.webp$/);
    expect((await sharp(writeLocal.mock.calls[0]![1]).metadata()).format).toBe("webp");
  });

  it("fails closed on Vercel without blob storage", async () => {
    await expect(
      storeUpload(
        { bytes: imageBytes, detected: jpeg, kind: "image" },
        { onVercel: true },
      ),
    ).rejects.toBeInstanceOf(UploadStorageUnavailableError);
  });

  it("writes to the object store when it is configured", async () => {
    const putObject = vi.fn<(input: PutObjectInput) => Promise<{ url: string }>>(async () => ({
      url: "https://files.timeweb.example/uploads/image/a.jpg",
    }));

    const stored = await storeUpload(
      { bytes: imageBytes, detected: jpeg, kind: "image" },
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
    const uploaded = putObject.mock.calls.at(0)?.at(0);
    expect(uploaded).toMatchObject({
      pathname: expect.stringMatching(/^uploads\/image\/.+\.webp$/),
      contentType: "image/webp",
      cacheControl: "public,max-age=31536000,immutable",
    });
    expect((await sharp(uploaded!.bytes).metadata()).format).toBe("webp");
    expect(stored.url).toBe("https://files.timeweb.example/uploads/image/a.jpg");
  });

  it("checks production storage availability before attempting image decoding", async () => {
    await expect(
      storeUpload(
        { bytes: new Uint8Array([0xff, 0xd8, 0xff]), detected: jpeg, kind: "image" },
        { isProduction: true, onVercel: false },
      ),
    ).rejects.toBeInstanceOf(UploadStorageUnavailableError);
  });

  it("preserves PDF bytes and extension", async () => {
    const bytes = Buffer.from("%PDF-1.7 unchanged document");
    const writeLocal = vi.fn<(path: string, bytes: Uint8Array) => Promise<void>>(async () => undefined);
    const result = await storeUpload({ bytes, kind: "document", detected: { kind: "document", extension: "pdf", contentType: "application/pdf" } }, { isProduction: false, onVercel: false, writeLocal });
    expect(result.url).toMatch(/\.pdf$/);
    expect(writeLocal.mock.calls[0]?.[1]).toEqual(bytes);
  });
});
