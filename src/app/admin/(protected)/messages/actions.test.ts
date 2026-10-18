import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  updateContactRequestMutation: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/features/admin-messages/mutation", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/admin-messages/mutation")
  >();
  return {
    ...actual,
    updateContactRequestMutation: mocks.updateContactRequestMutation,
  };
});

import { updateContactRequestAction } from "./actions";

const idle = { status: "idle" as const, message: "" };

describe("contact-request server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the bound id instead of a hidden payload id", async () => {
    const state = { status: "error" as const, message: "Проверьте форму" };
    mocks.updateContactRequestMutation.mockResolvedValue({ ok: false, state });
    const data = new FormData();
    data.set("id", "attacker-controlled-id");

    await expect(
      updateContactRequestAction("contact-1", idle, data),
    ).resolves.toEqual(state);

    expect(mocks.updateContactRequestMutation).toHaveBeenCalledWith(
      "contact-1",
      data,
    );
  });

  it("returns an error state without cache or navigation effects", async () => {
    const state = {
      status: "error" as const,
      message: "Данные изменились. Обновите страницу и повторите действие",
      values: { status: "CLOSED", note: "Перезвонить" },
    };
    mocks.updateContactRequestMutation.mockResolvedValue({ ok: false, state });

    await expect(
      updateContactRequestAction("contact-1", idle, new FormData()),
    ).resolves.toEqual(state);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("revalidates the dashboard and list before redirecting on success", async () => {
    const events: string[] = [];
    const redirected = new Error("redirected");
    mocks.updateContactRequestMutation.mockResolvedValue({
      ok: true,
      effect: {
        revalidate: ["/admin", "/admin/messages"],
        redirectTo: "/admin/messages/contact-1?success=saved",
      },
    });
    mocks.revalidatePath.mockImplementation((path: string) => {
      events.push(`revalidate:${path}`);
    });
    mocks.redirect.mockImplementation((path: string) => {
      events.push(`redirect:${path}`);
      throw redirected;
    });

    await expect(
      updateContactRequestAction("contact-1", idle, new FormData()),
    ).rejects.toBe(redirected);
    expect(events).toEqual([
      "revalidate:/admin",
      "revalidate:/admin/messages",
      "redirect:/admin/messages/contact-1?success=saved",
    ]);
  });

  it("keeps the server directive at module scope and contains no payload logging", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/admin/(protected)/messages/actions.ts"),
      "utf8",
    );

    expect(source).toMatch(/^['"]use server['"];\s/);
    expect(source).not.toMatch(
      /console\s*\.|JSON\.stringify\s*\(\s*formData|FormData\.entries/,
    );
  });
});
