import { describe, expect, it } from "vitest";

import { privateJsonResponse } from "./private-json-response";

describe("privateJsonResponse", () => {
  it("serializes JSON with privacy headers and a default 200 status", async () => {
    const response = privateJsonResponse({ ok: true });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(await response.text()).toBe('{"ok":true}');
  });

  it("uses an explicit 503 status", () => {
    const response = privateJsonResponse({ ok: false }, 503);

    expect(response.status).toBe(503);
  });
});
