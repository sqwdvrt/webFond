import sharp from "sharp";
import { expect, it } from "vitest";
import { prepareImage, ImageProcessingBusyError } from "../../src/features/uploads/prepare-image";

it("measures bounded decoding under five simultaneous maximum-pixel uploads", async () => {
  const input = await sharp({ create: { width: 5000, height: 5000, channels: 4, background: { r: 90, g: 130, b: 70, alpha: .5 } } }).png().toBuffer();
  expect(input.byteLength).toBeLessThanOrEqual(4_000_000);
  const initialRss = process.memoryUsage().rss;
  let sampledPeakRss = initialRss;
  const sample = setInterval(() => { sampledPeakRss = Math.max(sampledPeakRss, process.memoryUsage().rss); }, 10);
  const started = performance.now();
  try {
    const outcomes = await Promise.allSettled(Array.from({ length: 5 }, () => prepareImage(input)));
    const results = outcomes.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
    const rejected = outcomes.filter(result => result.status === "rejected");
    expect(results).toHaveLength(2);
    expect(rejected).toHaveLength(3);
    for (const result of rejected) if (result.status === "rejected") expect(result.reason).toBeInstanceOf(ImageProcessingBusyError);
    for (const bytes of results) {
      expect(await sharp(bytes).metadata()).toMatchObject({ format: "webp", width: 1440, height: 1440 });
    }
    sampledPeakRss = Math.max(sampledPeakRss, process.memoryUsage().rss);
    process.stdout.write(JSON.stringify({ name: "five-upload-memory", inputBytes: input.byteLength,
      outputBytes: results[0].byteLength, accepted: results.length, busy: rejected.length, initialRssBytes: initialRss, sampledPeakRssBytes: sampledPeakRss,
      durationMs: Math.round(performance.now() - started), runtime: process.version }) + "\n");
  } finally {
    clearInterval(sample);
  }
}, 30_000);
