import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireAdminSession: vi.fn(), getAuditPage: vi.fn() }));
vi.mock("@/lib/admin-auth/session", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/features/admin-audit/history", async (importOriginal) => ({ ...await importOriginal<typeof import("@/features/admin-audit/history")>(), getAuditPage: mocks.getAuditPage }));
import ChangesPage from "./page";
beforeEach(() => vi.resetAllMocks());
describe("changes page", () => {
  it("does not read history before authentication", async () => {
    mocks.requireAdminSession.mockRejectedValue(new Error("denied"));
    await expect(ChangesPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("denied");
    expect(mocks.getAuditPage).not.toHaveBeenCalled();
  });
  it("rejects invalid pages before reading and exposes pagination for a valid page", async () => {
    const { unmount } = render(await ChangesPage({ searchParams: Promise.resolve({ page: "bad" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Некорректный номер");
    expect(mocks.getAuditPage).not.toHaveBeenCalled(); unmount();
    mocks.getAuditPage.mockResolvedValue({ rows: [], page: 2, totalPages: 3, total: 60 });
    render(await ChangesPage({ searchParams: Promise.resolve({ page: "2" }) }));
    expect(mocks.getAuditPage).toHaveBeenCalledWith(2);
    expect(screen.getByRole("link", { name: "Назад" })).toHaveAttribute("href", "/admin/changes?page=1");
    expect(screen.getByRole("link", { name: "Далее" })).toHaveAttribute("href", "/admin/changes?page=3");
  });
});
