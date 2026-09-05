import { describe, expect, it, vi } from "vitest";

import { putS3Object, readObjectStoreConfig } from "./object-store";

describe("readObjectStoreConfig", () => {
  it("returns nothing until every S3 field is present", () => {
    expect(
      readObjectStoreConfig({
        S3_ENDPOINT: "https://s3.example",
        S3_BUCKET: "fond-uploads",
      }),
    ).toBeUndefined();
  });

  it("reads a complete Timeweb S3 config", () => {
    expect(
      readObjectStoreConfig({
        S3_ENDPOINT: " https://s3.example ",
        S3_REGION: "ru-1",
        S3_BUCKET: "fond-uploads",
        S3_ACCESS_KEY: "key",
        S3_SECRET_KEY: "secret",
        S3_PUBLIC_BASE_URL: "https://files.example/",
      }),
    ).toEqual({
      endpoint: "https://s3.example",
      region: "ru-1",
      bucket: "fond-uploads",
      accessKey: "key",
      secretKey: "secret",
      publicBaseUrl: "https://files.example",
    });
  });
});

describe("putS3Object", () => {
  it("PUTs the object with SigV4 headers and returns the public URL", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));

    const stored = await putS3Object(
      {
        endpoint: "https://s3.example",
        region: "ru-1",
        bucket: "fond-uploads",
        accessKey: "AKIA",
        secretKey: "secret",
        publicBaseUrl: "https://files.example",
      },
      {
        pathname: "uploads/image/a.jpg",
        bytes: new Uint8Array([0xff, 0xd8, 0xff]),
        contentType: "image/jpeg",
      },
      { fetchImpl: fetchImpl as typeof fetch, now: () => new Date("2026-09-05T20:00:00.000Z") },
    );

    expect(stored.url).toBe("https://files.example/uploads/image/a.jpg");
    expect(fetchImpl).toHaveBeenCalledOnce();
    const calls = fetchImpl.mock.calls as unknown as Array<[URL, RequestInit]>;
    const [url, init] = calls[0] ?? [];
    expect(String(url)).toBe("https://s3.example/fond-uploads/uploads/image/a.jpg");
    expect(init?.method).toBe("PUT");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIA\/20260905\/ru-1\/s3\/aws4_request,/,
    );
    expect(headers.get("x-amz-date")).toBe("20260905T200000Z");
  });
});
