import { describe, expect, it } from "vitest";

import { inspectUpload, parseUploadKind, UploadValidationError } from "./validate";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);

describe("inspectUpload", () => {
  it("accepts JPEG, PNG and PDF signatures for the matching kind", () => {
    expect(inspectUpload(jpeg, "image")).toMatchObject({
      extension: "jpg",
      contentType: "image/jpeg",
    });
    expect(inspectUpload(png, "image")).toMatchObject({ extension: "png" });
    expect(inspectUpload(pdf, "document")).toMatchObject({
      extension: "pdf",
      contentType: "application/pdf",
    });
  });

  it("rejects a PDF uploaded as an image", () => {
    expect(() => inspectUpload(pdf, "image")).toThrow(UploadValidationError);
  });

  it("rejects an empty payload", () => {
    expect(() => inspectUpload(new Uint8Array(), "image")).toThrow(
      UploadValidationError,
    );
  });
});

describe("parseUploadKind", () => {
  it("accepts only image and document", () => {
    expect(parseUploadKind("image")).toBe("image");
    expect(parseUploadKind("document")).toBe("document");
    expect(parseUploadKind("video")).toBeNull();
  });
});
