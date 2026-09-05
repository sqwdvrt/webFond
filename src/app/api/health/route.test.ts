import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /api/health", () => {
  it("answers without auth so Timeweb can probe a live process", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
