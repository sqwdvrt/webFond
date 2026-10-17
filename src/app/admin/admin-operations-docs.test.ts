import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readDocumentation = () =>
  ["README.md", "WORK_REPORT.md"]
    .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
    .join("\n")
    .replace(/\s+/g, " ");

const documentation = readDocumentation();

describe("admin operations operator documentation", () => {
  it("assigns pg_trgm ownership and schedules backup plus a maintenance window", () => {
    expect(documentation).toMatch(/pg_trgm[^.]{0,500}(?:владел|владеть)/i);
    expect(documentation).toMatch(/(?:резервн[а-яё]* коп[а-яё]*|backup)/i);
    expect(documentation).toMatch(/окн[а-яё]* обслуживан/i);
  });

  it("documents the guarded local admin operations database commands", () => {
    expect(documentation).toContain("ADMIN_OPERATIONS_TEST_DATABASE_URL");
    expect(documentation).toMatch(/(?:localhost|127\.0\.0\.1)/i);
    expect(documentation).toContain("_test");
  });

  it("states the exact strict NEW and PENDING stale thresholds", () => {
    expect(documentation).toMatch(/NEW[^.]{0,220}<\s*now\s*-\s*48\s*hours/i);
    expect(documentation).toMatch(/PENDING[^.]{0,220}<\s*now\s*-\s*1\s*hour/i);
  });

  it("prefers a forward fix over rollback", () => {
    expect(documentation).toMatch(/(?:forward[- ]fix|исправлен[а-яё]* вперед)/i);
  });

  it("requires a rollback-compatible build with a regenerated SPAM-aware Prisma client", () => {
    expect(documentation).toMatch(/совместим[а-яё]*[^.]{0,300}(?:сборк|build)/i);
    expect(documentation).toMatch(/(?:сгенерирован|перегенерирован|regenerated)[^.]{0,180}Prisma[^.]{0,180}SPAM/i);
  });

  it("prohibits the original artifact after SPAM may have been written", () => {
    expect(documentation).toMatch(/(?:исходн[а-яё]*|первоначальн[а-яё]*|original)[^.]{0,120}(?:артефакт|сборк)[^.]{0,300}(?:запрещ|нельзя|небезопас)/i);
    expect(documentation).toMatch(/SPAM[^.]{0,300}(?:неизвестн[а-яё]*|unknown)[^.]{0,100}(?:enum|перечислен)/i);
  });

  it("defines the approved lossy emergency remap before an old artifact", () => {
    expect(documentation).toMatch(/аварийн[а-яё]*[^.]{0,700}(?:резервн[а-яё]* коп[а-яё]*|backup)[^.]{0,700}окн[а-яё]* обслуживан/i);
    expect(documentation).toMatch(/(?:явн[а-яё]*|explicit)[^.]{0,100}(?:count|количеств|подсч)/i);
    expect(documentation).toMatch(/(?:согласован|одобрен|approved)[^.]{0,180}(?:транзакц|transaction)[^.]{0,180}SPAM[^.]{0,80}IN_PROGRESS/i);
    expect(documentation).toMatch(/(?:потер[а-яё]* классификац|lossy)[^.]{0,300}(?:журнал[а-яё]* изменен|change log)/i);
    expect(documentation).toMatch(/(?:до|перед)[^.]{0,180}(?:стар[а-яё]*|исходн[а-яё]*|original)[^.]{0,100}(?:артефакт|сборк)/i);
  });

  it("allows later cleanup only through a reviewed maintenance migration after zero-use proof", () => {
    expect(documentation).toMatch(/(?:последующ|поздн)[^.]{0,200}(?:очистк|удален)/i);
    expect(documentation).toMatch(/(?:свеж[а-яё]*|нов[а-яё]*)[^.]{0,100}(?:резервн[а-яё]* коп[а-яё]*|backup)/i);
    expect(documentation).toMatch(/(?:ноль|нулев|zero)[^.]{0,100}SPAM/i);
    expect(documentation).toMatch(/(?:internalNote[^.]{0,160}(?:audit|аудит)|(?:audit|аудит)[^.]{0,160}internalNote)[^.]{0,180}(?:не использ|не завис|zero|ноль)/i);
    expect(documentation).toMatch(/отдельн[а-яё]*[^.]{0,120}(?:проверен|reviewed)[^.]{0,120}миграц/i);
    expect(documentation).toMatch(/(?:не[^.]{0,30}ad[- ]?hoc SQL|не[^.]{0,80}разов[а-яё]* SQL)/i);
  });

  it("provides no destructive automatic down migration and leaves additive schema in place", () => {
    expect(documentation).toMatch(/(?:автоматическ[а-яё]*|automatic)[^.]{0,120}(?:destructive|разрушительн|деструктивн)[^.]{0,120}(?:down|откат)/i);
    expect(documentation).toMatch(/(?:additive|аддитивн|добавленн[а-яё]*)[^.]{0,140}(?:схем[а-яё]*)[^.]{0,100}(?:оста[её]тся|сохраняется|in place)/i);
  });
});
