import { describe, expect, it } from "vitest";

import { projects } from "@/content/projects";

describe("charter activities", () => {
  it("contains only the eight activity types from the charter", () => {
    expect(projects.map((activity) => activity.description)).toEqual([
      "Помощь социально незащищенным гражданам, находящимся в тяжелом материальном положении.",
      "Оказание помощи и поддержки пожилым людям, детям-сиротам, детям и престарелым гражданам, находящимся на попечении государства, малообеспеченным и иным лицам, нуждающимся в помощи.",
      "Содействие восстановлению, облагораживанию и охране объектов и территорий, имеющих историческую, культурную или природоохранную значимость.",
      "Объединение усилий организаций для оказания помощи нуждающимся, возрождения и развития меценатства.",
      "Проведение информационных и иных акций для помощи и поддержки нуждающихся.",
      "Привлечение добровольных пожертвований и денежных взносов российских организаций и граждан.",
      "Участие в государственных программах, получение и реализация грантов.",
      "Разработка и реализация проектов для финансирования социальной сферы с участием бизнеса, бюджета и физических лиц.",
    ]);
  });

  it("provides charter-faithful homepage summaries", () => {
    expect(projects.map((activity) => activity.homepageDescription)).toEqual([
      "Помощь социально незащищенным гражданам, оказавшимся в тяжелом материальном положении.",
      "Поддержка пожилых людей, детей-сирот, детей и престарелых граждан, находящихся на попечении государства, малообеспеченных и других людей, нуждающихся в помощи.",
      "Восстановление, облагораживание и охрана исторически, культурно и природоохранно значимых объектов и территорий.",
      "Объединение усилий организаций для помощи нуждающимся и развития меценатства.",
      "Проведение информационных и иных акций в помощь и поддержку нуждающихся.",
      "Привлечение добровольных пожертвований и денежных взносов российских организаций и граждан.",
      "Участие в государственных программах, получение и реализация грантов.",
      "Разработка и реализация проектов финансирования социальной сферы с участием бизнеса, бюджета и физических лиц.",
    ]);
  });

  it("does not expose project slugs, invented names, or metrics", () => {
    for (const activity of projects) {
      expect(activity).not.toHaveProperty("status");
      expect(activity).not.toHaveProperty("slug");
      expect(activity).not.toHaveProperty("href");
      expect(activity).not.toHaveProperty("title");
      expect(activity).not.toHaveProperty("raised");
      expect(activity).not.toHaveProperty("goal");
      expect(activity).not.toHaveProperty("beneficiaries");
    }
    expect(JSON.stringify(projects)).not.toMatch(
      /Помощь рядом|Забота о старших|Поддержка детям|pomoshch-ryadom|zabota-o-starshih|podderzhka-detyam/,
    );
  });

  it("groups charter activities into three public clusters", async () => {
    const { charterGroups } = await import("@/content/projects");
    expect(charterGroups.map((group) => group.title)).toEqual([
      "Люди",
      "Места и территории",
      "Как собираем помощь",
    ]);
    expect(charterGroups.flatMap((group) => [...group.items])).toEqual(projects);
  });
});
