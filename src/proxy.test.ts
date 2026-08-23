import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "./proxy";

describe("admin runtime privacy headers", () => {
  it("sets no-store headers for every admin route", () => {
    const response = proxy(
      new NextRequest("http://localhost/admin/donations?q=private"),
    );

    expect(config.matcher).toEqual(["/admin/:path*"]);
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
