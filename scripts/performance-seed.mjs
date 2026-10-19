import { PrismaClient } from "@prisma/client";

const value = process.env.PERF_SEED_DATABASE_URL;
if (!value) throw new Error("PERF_SEED_DATABASE_URL is required");
const url = new URL(value);
if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.pathname !== '/foundation_optimization_test') {
  throw new Error("Performance fixtures require local foundation_optimization_test");
}
const db = new PrismaClient({ datasourceUrl: value });
try {
  if (process.argv.includes('--clean')) {
    await db.$transaction([
      db.adminAuditEvent.deleteMany({ where: { id: { startsWith: 'perf-audit-' } } }),
      db.donation.deleteMany({ where: { id: { startsWith: 'perf-donation-' } } }),
      db.project.deleteMany({ where: { id: { startsWith: 'perf-project-' } } }),
      db.newsPost.deleteMany({ where: { id: { startsWith: 'perf-news-' } } }),
      db.document.deleteMany({ where: { id: { startsWith: 'perf-document-' } } }),
    ]);
    console.log('Removed only performance fixtures');
  } else {
    await db.$executeRaw`
      INSERT INTO "Project" (id, title, slug, summary, status, "publishedAt", "goalAmountKopecks", "manualRaisedKopecks", "createdAt", "updatedAt")
      SELECT 'perf-project-' || n, 'Тестовый проект ' || n, 'perf-project-' || n,
        'Синтетические данные для локального измерения', 'PUBLISHED',
        TIMESTAMP '2026-10-01' + n * INTERVAL '1 second', 1000000, 0, now(), now()
      FROM generate_series(1,1000) n ON CONFLICT DO NOTHING`;
    await db.$executeRaw`
      INSERT INTO "NewsPost" (id, title, slug, summary, status, "publishedAt", "createdAt", "updatedAt")
      SELECT 'perf-news-' || n, 'Тестовая новость ' || n, 'perf-news-' || n,
        'Синтетические данные для локального измерения', 'PUBLISHED',
        TIMESTAMP '2026-10-01' + n * INTERVAL '1 second', now(), now()
      FROM generate_series(1,1000) n ON CONFLICT DO NOTHING`;
    await db.$executeRaw`
      INSERT INTO "Document" (id, title, category, "fileUrl", status, "publishedAt", "createdAt", "updatedAt")
      SELECT 'perf-document-' || n, 'Тестовый документ ' || n, 'Отчётность',
        '/documents/performance-fixture.pdf', 'PUBLISHED',
        TIMESTAMP '2026-10-01' + n * INTERVAL '1 second', now(), now()
      FROM generate_series(1,1000) n ON CONFLICT DO NOTHING`;
    await db.$executeRaw`
      INSERT INTO "Donation" (id, "idempotenceKey", "amountKopecks", currency, status, "projectId", "paidAt", "createdAt", "updatedAt")
      SELECT 'perf-donation-' || n, 'perf-donation-' || n, 10000, 'RUB', 'SUCCEEDED',
        'perf-project-' || ((n - 1) % 1000 + 1), TIMESTAMP '2026-10-19 10:00:00', now(), now()
      FROM generate_series(1,100000) n ON CONFLICT DO NOTHING`;
    await db.$executeRaw`
      INSERT INTO "AdminAuditEvent" (id, "actorKind", action, "entityType", "entityId", "createdAt")
      SELECT 'perf-audit-' || n, 'ADMIN', 'CONTENT_PUBLISHED', 'PROJECT',
        CASE WHEN n = 10 THEN 'perf-project-missing' ELSE 'perf-project-' || (n % 3 + 1) END,
        now() + n * INTERVAL '1 second'
      FROM generate_series(1,10) n ON CONFLICT DO NOTHING`;
    await db.$executeRaw`ANALYZE "Project"`;
    await db.$executeRaw`ANALYZE "Donation"`;
    await db.$executeRaw`ANALYZE "NewsPost"`;
    await db.$executeRaw`ANALYZE "Document"`;
    console.log('Local fixtures ready: 1000 projects, 1000 news, 1000 documents, 100000 donations, 10 audit events');
  }
} finally {
  await db.$disconnect();
}
