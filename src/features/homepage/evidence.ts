import { listPublishedDocuments, type PublicDocumentRow } from "@/features/content-admin/repository";
import { listPublishedProjectsForDisplay, type PublicProjectCard } from "@/features/fundraising/public-projects";

export type HomeEvidenceData = {
  documents: PublicDocumentRow[] | null;
  projects: PublicProjectCard[] | null;
};

type EvidenceDependencies = {
  listDocuments: () => Promise<PublicDocumentRow[]>;
  listProjects: () => Promise<PublicProjectCard[]>;
};

export async function loadHomeEvidence(
  dependencies: EvidenceDependencies = {
    listDocuments: listPublishedDocuments,
    listProjects: listPublishedProjectsForDisplay,
  },
): Promise<HomeEvidenceData> {
  const [documents, projects] = await Promise.allSettled([
    dependencies.listDocuments(),
    dependencies.listProjects(),
  ]);
  return {
    documents: documents.status === "fulfilled" ? documents.value.slice(0, 3) : null,
    projects: projects.status === "fulfilled" ? projects.value.slice(0, 3) : null,
  };
}
