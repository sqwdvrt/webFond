import { afterEach, describe, expect, it, vi } from "vitest";

const constructorSpy = vi.hoisted(() => vi.fn());

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    constructor() {
      constructorSpy();
    }
  },
}));

describe("Prisma client", () => {
  afterEach(() => {
    delete (globalThis as typeof globalThis & { prisma?: unknown }).prisma;
    vi.unstubAllEnvs();
    vi.resetModules();
    constructorSpy.mockClear();
  });

  it("reuses the development client across module reloads", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const first = await import("./db");
    vi.resetModules();
    const second = await import("./db");

    expect(second.prisma).toBe(first.prisma);
    expect(constructorSpy).toHaveBeenCalledOnce();
  });
});
