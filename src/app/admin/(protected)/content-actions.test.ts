import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  createProjectMutation: vi.fn(),
  updateProjectMutation: vi.fn(),
  deleteProjectMutation: vi.fn(),
  createNewsMutation: vi.fn(),
  updateNewsMutation: vi.fn(),
  deleteNewsMutation: vi.fn(),
  createDocumentMutation: vi.fn(),
  updateDocumentMutation: vi.fn(),
  deleteDocumentMutation: vi.fn(),
  saveRequisitesMutation: vi.fn(),
  replaceInvalidRequisitesMutation: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/features/content-admin/mutations", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/content-admin/mutations")
  >();
  return {
    ...actual,
    createProjectMutation: mocks.createProjectMutation,
    updateProjectMutation: mocks.updateProjectMutation,
    deleteProjectMutation: mocks.deleteProjectMutation,
    createNewsMutation: mocks.createNewsMutation,
    updateNewsMutation: mocks.updateNewsMutation,
    deleteNewsMutation: mocks.deleteNewsMutation,
    createDocumentMutation: mocks.createDocumentMutation,
    updateDocumentMutation: mocks.updateDocumentMutation,
    deleteDocumentMutation: mocks.deleteDocumentMutation,
    saveRequisitesMutation: mocks.saveRequisitesMutation,
    replaceInvalidRequisitesMutation: mocks.replaceInvalidRequisitesMutation,
  };
});

import {
  createDocumentAction,
  createNewsAction,
  createProjectAction,
  deleteDocumentAction,
  deleteNewsAction,
  deleteProjectAction,
  replaceInvalidRequisitesAction,
  saveRequisitesAction,
  updateDocumentAction,
  updateNewsAction,
  updateProjectAction,
} from "./content-actions";

const idle = { status: "idle" as const, message: "" };

describe("content server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["project create", mocks.createProjectMutation, (data: FormData) => createProjectAction(idle, data)],
    ["project update", mocks.updateProjectMutation, (data: FormData) => updateProjectAction("project-1", idle, data)],
    ["project delete", mocks.deleteProjectMutation, (data: FormData) => deleteProjectAction("project-1", "project-slug", idle, data)],
    ["news create", mocks.createNewsMutation, (data: FormData) => createNewsAction(idle, data)],
    ["news update", mocks.updateNewsMutation, (data: FormData) => updateNewsAction("news-1", idle, data)],
    ["news delete", mocks.deleteNewsMutation, (data: FormData) => deleteNewsAction("news-1", "news-slug", idle, data)],
    ["document create", mocks.createDocumentMutation, (data: FormData) => createDocumentAction(idle, data)],
    ["document update", mocks.updateDocumentMutation, (data: FormData) => updateDocumentAction("document-1", idle, data)],
    ["document delete", mocks.deleteDocumentMutation, (data: FormData) => deleteDocumentAction("document-1", idle, data)],
    ["requisites save", mocks.saveRequisitesMutation, (data: FormData) => saveRequisitesAction(idle, data)],
    ["invalid requisites replace", mocks.replaceInvalidRequisitesMutation, (data: FormData) => replaceInvalidRequisitesAction(idle, data)],
  ])("applies every deduplicated path before redirect for %s", async (_name, mutation, invoke) => {
    const events: string[] = [];
    const redirected = new Error("redirected");
    mutation.mockResolvedValue({
      ok: true,
      effect: {
        revalidate: ["/admin/content", "/public/content", "/sitemap.xml"],
        redirectTo: "/admin/content?success=saved",
      },
    });
    mocks.revalidatePath.mockImplementation((path: string) => {
      events.push(`revalidate:${path}`);
    });
    mocks.redirect.mockImplementation((path: string) => {
      events.push(`redirect:${path}`);
      throw redirected;
    });
    const data = new FormData();
    data.set("privateField", "must-not-be-logged");

    await expect(invoke(data)).rejects.toBe(redirected);
    expect(mutation).toHaveBeenCalledOnce();
    expect(events).toEqual([
      "revalidate:/admin/content",
      "revalidate:/public/content",
      "revalidate:/sitemap.xml",
      "redirect:/admin/content?success=saved",
    ]);
  });

  it.each([
    ["project create", mocks.createProjectMutation, (data: FormData) => createProjectAction(idle, data)],
    ["project update", mocks.updateProjectMutation, (data: FormData) => updateProjectAction("project-1", idle, data)],
    ["project delete", mocks.deleteProjectMutation, (data: FormData) => deleteProjectAction("project-1", "project-slug", idle, data)],
    ["news create", mocks.createNewsMutation, (data: FormData) => createNewsAction(idle, data)],
    ["news update", mocks.updateNewsMutation, (data: FormData) => updateNewsAction("news-1", idle, data)],
    ["news delete", mocks.deleteNewsMutation, (data: FormData) => deleteNewsAction("news-1", "news-slug", idle, data)],
    ["document create", mocks.createDocumentMutation, (data: FormData) => createDocumentAction(idle, data)],
    ["document update", mocks.updateDocumentMutation, (data: FormData) => updateDocumentAction("document-1", idle, data)],
    ["document delete", mocks.deleteDocumentMutation, (data: FormData) => deleteDocumentAction("document-1", idle, data)],
    ["requisites save", mocks.saveRequisitesMutation, (data: FormData) => saveRequisitesAction(idle, data)],
    ["invalid requisites replace", mocks.replaceInvalidRequisitesMutation, (data: FormData) => replaceInvalidRequisitesAction(idle, data)],
  ])("returns the form state without effects for %s errors", async (_name, mutation, invoke) => {
    const state = { status: "error" as const, message: "Проверьте форму" };
    mutation.mockResolvedValue({ ok: false, state });

    await expect(invoke(new FormData())).resolves.toEqual(state);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("keeps the server directive at module scope and contains no payload logging", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/app/admin/(protected)/content-actions.ts",
      ),
      "utf8",
    );

    expect(source).toMatch(/^['"]use server['"];\s/);
    expect(source).not.toMatch(/console\s*\.|JSON\.stringify\s*\(\s*formData|FormData\.entries/);
  });
});
