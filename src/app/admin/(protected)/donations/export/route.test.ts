import { describe, expect, it, vi } from "vitest";

import { handleDonationExport } from "./route";

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    requireSession: vi.fn(async () => ({ username: "fixture-operator" })),
    parseFilters: vi.fn(() => ({ ok: true as const, value: { status: "SUCCEEDED" as const } })),
    createStream: vi.fn(async () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("fixture csv"));
          controller.close();
        },
      }),
    ),
    now: () => new Date("2026-08-22T22:00:00.000Z"),
    ...overrides,
  };
}

describe("donation CSV route", () => {
  it("checks auth before parsing or querying", async () => {
    const denied = new Error("guest denied");
    const deps = dependencies({
      requireSession: vi.fn(async () => {
        throw denied;
      }),
    });

    await expect(
      handleDonationExport(
        new Request("http://localhost/admin/donations/export?q=private"),
        deps,
      ),
    ).rejects.toBe(denied);
    expect(deps.parseFilters).not.toHaveBeenCalled();
    expect(deps.createStream).not.toHaveBeenCalled();
  });

  it("returns 400 without querying for invalid filters", async () => {
    const deps = dependencies({
      parseFilters: vi.fn(() => ({ ok: false as const })),
    });

    const response = await handleDonationExport(
      new Request("http://localhost/admin/donations/export?status=INVALID"),
      deps,
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Некорректные фильтры");
    expect(deps.createStream).not.toHaveBeenCalled();
  });

  it("returns a neutral 500 when the first batch fails", async () => {
    const deps = dependencies({
      createStream: vi.fn(async () => {
        throw new Error("Prisma secret details");
      }),
    });

    const response = await handleDonationExport(
      new Request("http://localhost/admin/donations/export"),
      deps,
    );

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Не удалось сформировать CSV");
  });

  it("returns exact CSV and privacy headers using the Moscow date", async () => {
    const deps = dependencies();
    const response = await handleDonationExport(
      new Request(
        "http://localhost/admin/donations/export?status=SUCCEEDED&page=x&page=y",
      ),
      deps,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/csv; charset=utf-8",
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="donations-2026-08-23.csv"',
    );
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
