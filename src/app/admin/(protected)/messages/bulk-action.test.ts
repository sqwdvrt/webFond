import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdminSession: vi.fn(), moveContactSelection: vi.fn(), revalidatePath: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/admin-auth/session", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/features/admin-messages/bulk", async (importOriginal) => ({ ...await importOriginal<typeof import("@/features/admin-messages/bulk")>(), moveContactSelection: mocks.moveContactSelection }));
import { moveContactSelectionAction } from "./actions";
import { ContactSelectionConflict } from "@/features/admin-messages/bulk";

const idle = { status: "idle" as const, message: "" };
function data() {
  const form = new FormData(); form.set("folder", "INBOX"); form.set("intent", "archive");
  form.set("selection", JSON.stringify({ id: "contact-1", updatedAt: "2026-10-19T10:00:00.000Z" }));
  form.set("returnTo", "https://evil.test"); return form;
}
beforeEach(() => vi.resetAllMocks());
describe("bulk server action", () => {
  it("authenticates before accepting any mutation", async () => {
    mocks.requireAdminSession.mockRejectedValue(new Error("denied"));
    await expect(moveContactSelectionAction(idle, data())).rejects.toThrow("denied");
    expect(mocks.moveContactSelection).not.toHaveBeenCalled();
  });
  it("rejects malformed selections and preserves safe conflict errors", async () => {
    expect((await moveContactSelectionAction(idle, new FormData())).status).toBe("error");
    expect(mocks.moveContactSelection).not.toHaveBeenCalled();
    mocks.moveContactSelection.mockRejectedValue(new ContactSelectionConflict());
    expect((await moveContactSelectionAction(idle, data())).message).toContain("Ни одно письмо не перемещено");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("invalidates lists and details and sanitizes the return URL after success", async () => {
    const redirected = new Error("redirect"); mocks.redirect.mockImplementation(() => { throw redirected; });
    await expect(moveContactSelectionAction(idle, data())).rejects.toBe(redirected);
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual(["/admin", "/admin/messages", "/admin/changes", "/admin/messages/contact-1"]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin", "layout");
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/messages");
  });
});
