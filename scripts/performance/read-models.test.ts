import { PrismaClient } from "@prisma/client";
import { expect, it } from "vitest";
import { listHomeDocuments, listPublishedDocuments } from "@/features/content-admin/repository";
import { listHomeProjectsForDisplay, listPublishedProjectsForDisplay } from "@/features/fundraising/public-projects";
import { getAdminDashboardReadModel, type DashboardDatabase } from "@/features/admin-dashboard/read-model";
import { listSitemapDocuments, listSitemapNews, listSitemapProjects } from "@/features/content-admin/sitemap-repository";

const value = process.env.PERF_SEED_DATABASE_URL;
if (!value) throw new Error("PERF_SEED_DATABASE_URL is required for the explicit performance harness");
const url = new URL(value);
if (!["postgres:", "postgresql:"].includes(url.protocol) || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/foundation_optimization_test") {
  throw new Error("Performance harness requires local foundation_optimization_test");
}

it("records real query operations and returned rows against synthetic fixtures", async () => {
  const client = new PrismaClient({ datasourceUrl: value });
  const operations: Array<{ model: string; operation: string; rows: number }> = [];
  const traced = client.$extends({ query: { $allModels: {
    async $allOperations({ model, operation, args, query }) {
      const result = await query(args);
      operations.push({ model, operation, rows: Array.isArray(result) ? result.length : result === null ? 0 : 1 });
      return result;
    },
  } } });
  try {
    const fullProjects = await listPublishedProjectsForDisplay(traced);
    const fullDocuments = await listPublishedDocuments(traced);
    expect(fullProjects).toHaveLength(1000);
    expect(fullDocuments).toHaveLength(1000);
    process.stdout.write(JSON.stringify({ name: "home-before", operations: [...operations] }) + "\n");
    operations.length = 0;

    const [projects, documents] = await Promise.all([listHomeProjectsForDisplay(traced), listHomeDocuments(traced)]);
    expect(projects).toEqual(fullProjects.slice(0, 3));
    expect(documents).toEqual(fullDocuments.slice(0, 3));
    expect(operations).toHaveLength(3);
    expect(operations.every(item => item.rows === 3)).toBe(true);
    process.stdout.write(JSON.stringify({ name: "home-after", operations: [...operations] }) + "\n");
    operations.length = 0;

    const model = await getAdminDashboardReadModel(new Date("2026-10-19T12:00:00Z"), {
      database: traced as unknown as DashboardDatabase,
      evaluateReadiness: () => ({ ok: true, issues: [] }), paymentsEnabled: () => false,
    });
    expect(model.recentActivity).toHaveLength(5);
    expect(model.recentActivity.filter(event => event.href === null)).toHaveLength(1);
    expect(operations.filter(item => item.model === "Project" && item.operation === "findMany")).toEqual([{ model: "Project", operation: "findMany", rows: 3 }]);
    expect(operations).toHaveLength(12);
    process.stdout.write(JSON.stringify({ name: "dashboard-after", operations: [...operations] }) + "\n");
    operations.length = 0;

    await Promise.all([listSitemapProjects(traced), listSitemapNews(traced), listSitemapDocuments(traced)]);
    expect(operations.find(item => item.model === "Document")).toEqual({ model: "Document", operation: "findFirst", rows: 1 });
    process.stdout.write(JSON.stringify({ name: "sitemap-after", operations }) + "\n");
    const plans = await client.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>('EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM "Project" WHERE status = \'PUBLISHED\' ORDER BY "publishedAt" DESC, id DESC LIMIT 3');
    process.stdout.write(JSON.stringify({ name: "home-project-explain", plan: plans.map(row => row["QUERY PLAN"]) }) + "\n");
  } finally {
    await client.$disconnect();
  }
});
