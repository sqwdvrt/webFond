import { prisma } from "@/lib/db";

import {
  fundraisingProgress,
  type FundraisingProgress,
} from "./progress";
import { sumSucceededDonationKopecksByProjectId } from "./totals";

const publicProjectListSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  imageUrl: true,
  publishedAt: true,
  goalAmountKopecks: true,
  manualRaisedKopecks: true,
} as const;

const publicProjectDetailSelect = {
  ...publicProjectListSelect,
  content: true,
} as const;

const publicOrder = [
  { publishedAt: "desc" as const },
  { id: "desc" as const },
];

export type PublicProjectCard = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: Date | null;
  fundraising: FundraisingProgress | null;
};

export type PublicProjectDetail = PublicProjectCard & {
  content: string | null;
};

type ProjectListRow = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: Date | null;
  goalAmountKopecks: number | null;
  manualRaisedKopecks: number;
};

type PublicProjectClient = {
  project: {
    findMany(args: {
      where: { status: "PUBLISHED" };
      select: typeof publicProjectListSelect;
      orderBy: typeof publicOrder;
    }): Promise<ProjectListRow[]>;
    findFirst(args: {
      where: { slug: string; status: "PUBLISHED" };
      select: typeof publicProjectDetailSelect | { id: true };
    }): Promise<(ProjectListRow & { content: string | null }) | { id: string } | null>;
  };
  donation: {
    groupBy(args: {
      by: ["projectId"];
      where: {
        status: "SUCCEEDED";
        projectId: { in: string[] };
      };
      _sum: { amountKopecks: true };
    }): Promise<
      Array<{
        projectId: string | null;
        _sum: { amountKopecks: number | null };
      }>
    >;
  };
};

function toCard(
  row: ProjectListRow,
  onlineSucceededKopecks: number,
): PublicProjectCard {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    imageUrl: row.imageUrl,
    publishedAt: row.publishedAt,
    fundraising: fundraisingProgress({
      goalAmountKopecks: row.goalAmountKopecks,
      onlineSucceededKopecks,
      manualRaisedKopecks: row.manualRaisedKopecks,
    }),
  };
}

async function onlineTotals(
  rows: ProjectListRow[],
  client: PublicProjectClient,
) {
  const ids = rows
    .filter(
      (row) => row.goalAmountKopecks != null && row.goalAmountKopecks > 0,
    )
    .map((row) => row.id);

  return sumSucceededDonationKopecksByProjectId(ids, client);
}

export async function listPublishedProjectsForDisplay(
  client: PublicProjectClient = prisma as unknown as PublicProjectClient,
): Promise<PublicProjectCard[]> {
  const rows = await client.project.findMany({
    where: { status: "PUBLISHED" },
    select: publicProjectListSelect,
    orderBy: publicOrder,
  });
  const sums = await onlineTotals(rows, client);

  return rows.map((row) => toCard(row, sums.get(row.id) ?? 0));
}

export async function getPublishedProjectForDisplay(
  slug: string,
  client: PublicProjectClient = prisma as unknown as PublicProjectClient,
): Promise<PublicProjectDetail | null> {
  const row = await client.project.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: publicProjectDetailSelect,
  });
  if (!row || !("content" in row)) return null;

  const sums = await onlineTotals([row], client);
  const { content, ...rest } = row;

  return {
    ...toCard(rest, sums.get(row.id) ?? 0),
    content,
  };
}

export async function findPublishedProjectIdBySlug(
  slug: string,
  client: PublicProjectClient = prisma as unknown as PublicProjectClient,
): Promise<string | null> {
  const row = await client.project.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { id: true },
  });
  return row?.id ?? null;
}

export async function listPublishedProjectDonationOptions(
  client: PublicProjectClient = prisma as unknown as PublicProjectClient,
): Promise<Array<{ slug: string; title: string }>> {
  const rows = await client.project.findMany({
    where: { status: "PUBLISHED" },
    select: publicProjectListSelect,
    orderBy: publicOrder,
  });

  return rows.map((row) => ({ slug: row.slug, title: row.title }));
}
