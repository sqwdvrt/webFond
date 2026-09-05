import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("image optimizer", () => {
  it("does not write optimized images to .next/cache on the Timeweb runtime", () => {
    expect(nextConfig.images).toEqual({ unoptimized: true });
  });
});
