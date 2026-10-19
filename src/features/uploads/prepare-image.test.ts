// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { prepareImage, ImageProcessingBusyError } from "./prepare-image";
import { UploadValidationError } from "./validate";

const image = (width = 2000, height = 1000) => sharp({ create: { width, height, channels: 4, background: { r: 150, g: 70, b: 40, alpha: 0.5 } } });

describe("prepareImage", () => {
  it("limits simultaneous decodes to two without queuing and releases capacity afterwards", async () => {
    const input = await image(40, 20).png().toBuffer();
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => prepareImage(input)));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(2);
    const rejected = results.filter(result => result.status === "rejected");
    expect(rejected).toHaveLength(3);
    for (const result of rejected) if (result.status === "rejected") expect(result.reason).toBeInstanceOf(ImageProcessingBusyError);
    await expect(prepareImage(input)).resolves.toBeInstanceOf(Uint8Array);
  });
  it.each(["jpeg", "png", "webp"] as const)("decodes %s to a bounded metadata-free WebP", async (format) => {
    const input = await image().toFormat(format).withMetadata({ orientation: 6 }).toBuffer();
    const output = await prepareImage(input);
    const metadata = await sharp(output).metadata();
    expect(metadata).toMatchObject({ format: "webp", width: 720, height: 1440 });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
    expect((await sharp(output).raw().toBuffer()).length).toBeGreaterThan(0);
    if (format !== "jpeg") expect(metadata.hasAlpha).toBe(true);
  });

  it("preserves small image dimensions and transparent pixels", async () => {
    const output = await prepareImage(await image(20, 10).png().toBuffer());
    const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
    expect(info).toMatchObject({ width: 20, height: 10, channels: 4 });
    expect(data[3]).toBeGreaterThan(0);
    expect(data[3]).toBeLessThan(255);
  });

  it("rejects damaged images", async () => {
    await expect(prepareImage(Buffer.from([0xff, 0xd8, 0xff]))).rejects.toBeInstanceOf(UploadValidationError);
    const png = await image(20, 10).png().toBuffer();
    await expect(prepareImage(png.subarray(0, png.length - 30))).rejects.toBeInstanceOf(UploadValidationError);
  });

  it("rejects images above the decoded pixel budget", async () => {
    const input = await image(5001, 5000).png().toBuffer();
    await expect(prepareImage(input)).rejects.toBeInstanceOf(UploadValidationError);
  });

  it("rejects animated WebP instead of silently storing its first frame", async () => {
    const frames = Buffer.alloc(4 * 4 * 4 * 2, 128);
    frames.fill(255, 4 * 4 * 4);
    const input = await sharp(frames, { raw: { width: 4, height: 8, channels: 4, pageHeight: 4 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
    expect((await sharp(input, { animated: true }).metadata()).pages).toBe(2);
    await expect(prepareImage(input)).rejects.toBeInstanceOf(UploadValidationError);
  });
});

// Encode valid APNG chunks from real PNG frames; Sharp itself only writes static PNG.
function pngChunk(type: string, data: Buffer) {
  const payload = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of payload) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, payload, checksum]);
}

it("rejects animated PNG instead of losing animation", async () => {
  const frames = await Promise.all(["red", "blue"].map(background => sharp({ create: { width: 4, height: 4, channels: 4, background } }).png().toBuffer()));
  const chunks = (png: Buffer) => {
    const result: { type: string; data: Buffer }[] = [];
    for (let offset = 8; offset < png.length;) {
      const size = png.readUInt32BE(offset);
      result.push({ type: png.toString("ascii", offset + 4, offset + 8), data: png.subarray(offset + 8, offset + 8 + size) });
      offset += size + 12;
    }
    return result;
  };
  const a = chunks(frames[0]); const b = chunks(frames[1]);
  const animation = Buffer.alloc(8); animation.writeUInt32BE(2);
  const control = (sequence: number) => {
    const data = Buffer.alloc(26); data.writeUInt32BE(sequence); data.writeUInt32BE(4, 4); data.writeUInt32BE(4, 8); data.writeUInt16BE(1, 20); data.writeUInt16BE(10, 22); return data;
  };
  const frameData = Buffer.concat(b.filter(c => c.type === "IDAT").map(c => c.data));
  const sequence = Buffer.alloc(4); sequence.writeUInt32BE(2);
  const apng = Buffer.concat([frames[0].subarray(0, 8), pngChunk("IHDR", a[0].data), pngChunk("acTL", animation), pngChunk("fcTL", control(0)), ...a.filter(c => c.type === "IDAT").map(c => pngChunk(c.type, c.data)), pngChunk("fcTL", control(1)), pngChunk("fdAT", Buffer.concat([sequence, frameData])), pngChunk("IEND", Buffer.alloc(0))]);
  expect((await sharp(apng).raw().toBuffer()).length).toBe(4 * 4 * 4);
  await expect(prepareImage(apng)).rejects.toBeInstanceOf(UploadValidationError);
});
