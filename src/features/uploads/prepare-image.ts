import sharp from "sharp";

import { UploadValidationError } from "./validate";

// Reject excess work instead of queuing buffers in a small application container.
let activeTransforms = 0;
const MAX_ACTIVE_TRANSFORMS = 2;

export class ImageProcessingBusyError extends Error {
  constructor() {
    super("Image processing capacity reached");
    this.name = "ImageProcessingBusyError";
  }
}

// libvips can expose only the first APNG frame, so check its chunk structure.
function isAnimatedPng(bytes: Uint8Array) {
  const png = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
  for (let offset = 8; offset + 12 <= png.length;) {
    const size = png.readUInt32BE(offset);
    if (offset + 12 + size > png.length) break;
    if (png.toString("ascii", offset + 4, offset + 8) === "acTL") return true;
    offset += size + 12;
  }
  return false;
}

/** Normalize new editorial uploads only; existing media URLs remain unchanged. */
export async function prepareImage(bytes: Uint8Array): Promise<Uint8Array> {
  if (activeTransforms >= MAX_ACTIVE_TRANSFORMS) throw new ImageProcessingBusyError();
  activeTransforms++;
  try {
    if (isAnimatedPng(bytes)) throw new Error("Animated PNG");
    const image = sharp(bytes, { limitInputPixels: 25_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if ((metadata.pages ?? 1) > 1 || !["jpeg", "png", "webp"].includes(metadata.format ?? "")) {
      throw new Error("Unsupported image");
    }
    return await image.rotate()
      .resize({ width: 1440, height: 1440, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();
  } catch {
    throw new UploadValidationError("Изображение повреждено, анимировано или слишком большое");
  } finally {
    activeTransforms--;
  }
}
