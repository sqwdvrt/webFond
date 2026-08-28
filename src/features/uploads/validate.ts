export type UploadKind = "image" | "document";

export type DetectedUpload = {
  kind: UploadKind;
  extension: string;
  contentType: string;
};

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

const IMAGE_MAX_BYTES = 4_000_000;
const DOCUMENT_MAX_BYTES = 4_000_000;

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function detectImage(bytes: Uint8Array): DetectedUpload | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { kind: "image", extension: "jpg", contentType: "image/jpeg" };
  }

  if (
    startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return { kind: "image", extension: "png", contentType: "image/png" };
  }

  if (
    bytes.length >= 12 &&
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { kind: "image", extension: "webp", contentType: "image/webp" };
  }

  return null;
}

function detectDocument(bytes: Uint8Array): DetectedUpload | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) {
    return { kind: "document", extension: "pdf", contentType: "application/pdf" };
  }

  return null;
}

export function parseUploadKind(value: FormDataEntryValue | null): UploadKind | null {
  return value === "image" || value === "document" ? value : null;
}

export function inspectUpload(
  bytes: Uint8Array,
  kind: UploadKind,
): DetectedUpload {
  const limit = kind === "image" ? IMAGE_MAX_BYTES : DOCUMENT_MAX_BYTES;

  if (bytes.byteLength === 0 || bytes.byteLength > limit) {
    throw new UploadValidationError("Файл слишком большой или пустой");
  }

  const detected = kind === "image" ? detectImage(bytes) : detectDocument(bytes);

  if (!detected) {
    throw new UploadValidationError(
      kind === "image"
        ? "Нужен файл JPEG, PNG или WebP"
        : "Нужен файл PDF",
    );
  }

  return detected;
}
