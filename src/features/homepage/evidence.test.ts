import { describe, expect, it } from "vitest";
import { loadHomeEvidence } from "./evidence";
import type { PublicDocumentRow } from "@/features/content-admin/repository";
import type { PublicProjectCard } from "@/features/fundraising/public-projects";

const documents: PublicDocumentRow[] = Array.from({ length: 4 }, (_, index) => ({
  id: `doc-${index}`, title: `Отчет ${index}`, category: "Отчетность", fileUrl: `/documents/${index}.pdf`,
  publishedAt: new Date("2026-10-01T12:00:00Z"), updatedAt: new Date("2026-10-02T12:00:00Z"),
}));
const projects: PublicProjectCard[] = Array.from({ length: 4 }, (_, index) => ({
  id: `project-${index}`, slug: `project-${index}`, title: `Проект ${index}`, summary: null,
  imageUrl: null, publishedAt: null, fundraising: null,
}));

describe("homepage evidence", () => {
  it("keeps at most three entries in the published repositories' order", async () => {
    expect(await loadHomeEvidence({ listDocuments: async () => documents, listProjects: async () => projects }))
      .toEqual({ documents: documents.slice(0, 3), projects: projects.slice(0, 3) });
  });
  it.each(["documents", "projects"])("isolates a failure of %s", async (failed) => {
    const result = await loadHomeEvidence({
      listDocuments: async () => { if (failed === "documents") throw new Error("private"); return documents; },
      listProjects: async () => { if (failed === "projects") throw new Error("private"); return projects; },
    });
    expect(result.documents).toEqual(failed === "documents" ? null : documents.slice(0, 3));
    expect(result.projects).toEqual(failed === "projects" ? null : projects.slice(0, 3));
  });
  it("distinguishes empty collections from failures", async () => {
    expect(await loadHomeEvidence({ listDocuments: async () => [], listProjects: async () => [] }))
      .toEqual({ documents: [], projects: [] });
  });
});
