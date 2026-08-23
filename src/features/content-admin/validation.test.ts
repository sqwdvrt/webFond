import type { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  defaultRequisitesDraft,
  parseDocumentForm,
  parseEditorialForm,
  parseRequisitesForm,
  parseRequisitesSetting,
  publicationTimestamp,
} from "./validation";

function form(fields: Record<string, string | string[]>) {
  const data = new FormData();

  for (const [name, value] of Object.entries(fields)) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      data.append(name, entry);
    }
  }

  return data;
}

function expectValid<T>(result: { ok: true; value: T } | { ok: false }) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected valid form data");
  return result.value;
}

describe("parseEditorialForm", () => {
  const validDraft = {
    title: "  Помощь рядом  ",
    slug: "  pomoshch-ryadom  ",
    summary: "   ",
    content: "  Первый абзац.\n\n  Второй абзац.  ",
    imageUrl: "  /images/project.jpg  ",
    status: "  DRAFT  ",
  };

  it("normalizes known fields and ignores unknown fields", () => {
    const data = form({ ...validDraft, role: "admin", title: "  Проект фонда  " });

    expect(expectValid(parseEditorialForm(data))).toEqual({
      title: "Проект фонда",
      slug: "pomoshch-ryadom",
      summary: null,
      content: "Первый абзац.\n\n  Второй абзац.",
      imageUrl: "/images/project.jpg",
      status: "DRAFT",
    });
  });

  it("requires substantial summary and content for publication", () => {
    const result = parseEditorialForm(
      form({ ...validDraft, status: "PUBLISHED", summary: "коротко", content: "мало" }),
    );

    expect(result).toMatchObject({
      ok: false,
      errors: { summary: expect.any(String), content: expect.any(String) },
      values: { summary: "коротко", content: "мало", status: "PUBLISHED" },
    });
  });

  it("accepts a published editorial at all boundaries", () => {
    const value = expectValid(
      parseEditorialForm(
        form({
          title: "TT",
          slug: "a1",
          summary: "s".repeat(10),
          content: "c".repeat(20),
          imageUrl: "https://example.org/image.jpg",
          status: "PUBLISHED",
        }),
      ),
    );

    expect(value.status).toBe("PUBLISHED");
  });

  it("normalizes CRLF paragraphs and permits LF paragraphs in content", () => {
    const value = expectValid(
      parseEditorialForm(
        form({
          ...validDraft,
          content: "  Первый абзац.\r\n\r\nВторой абзац.\nТретий абзац.  ",
        }),
      ),
    );

    expect(value.content).toBe(
      "Первый абзац.\n\nВторой абзац.\nТретий абзац.",
    );
  });

  it.each([
    ["title", "Про\u0000ект"],
    ["slug", "project\u0085slug"],
    ["summary", "Краткое\u009f описание"],
    ["content", "Абзац\tс табуляцией"],
    ["content", "Абзац\rбез LF"],
    ["imageUrl", "/images/pro\u0085ject.jpg"],
    ["status", "DRAFT\u0000"],
  ])("rejects embedded controls in editorial %s", (field, value) => {
    const result = parseEditorialForm(form({ ...validDraft, [field]: value }));

    expect(result).toMatchObject({ ok: false, errors: { [field]: expect.any(String) } });
  });

  it.each([
    ["title", "😀", false],
    ["title", "😀".repeat(160), true],
    ["title", "😀".repeat(161), false],
    ["summary", "😀".repeat(500), true],
    ["summary", "😀".repeat(501), false],
    ["content", "😀".repeat(20_000), true],
    ["content", "😀".repeat(20_001), false],
  ] as const)("counts editorial %s length by code point", (field, value, valid) => {
    const result = parseEditorialForm(form({ ...validDraft, [field]: value }));

    expect(result.ok).toBe(valid);
  });

  it.each([
    [`/${"😀".repeat(2047)}`, true],
    [`/${"😀".repeat(2048)}`, false],
  ] as const)("counts URL length by code point", (imageUrl, valid) => {
    expect(parseEditorialForm(form({ ...validDraft, imageUrl })).ok).toBe(valid);
  });

  it("uses code-point minimums for published editorial text", () => {
    const result = parseEditorialForm(
      form({
        ...validDraft,
        status: "PUBLISHED",
        summary: "😀".repeat(9),
        content: "😀".repeat(19),
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      errors: { summary: expect.any(String), content: expect.any(String) },
    });
  });

  it.each([
    ["title", "x"],
    ["title", "x".repeat(161)],
    ["slug", "A-valid-slug"],
    ["slug", "leading-"],
    ["slug", "two--hyphens"],
    ["slug", "x".repeat(121)],
    ["summary", "x".repeat(501)],
    ["content", "x".repeat(20_001)],
    ["status", "published"],
  ])("rejects invalid %s", (field, value) => {
    const result = parseEditorialForm(form({ ...validDraft, [field]: value }));

    expect(result).toMatchObject({ ok: false, errors: { [field]: expect.any(String) } });
  });

  it.each(["title", "slug", "summary", "content", "imageUrl", "status"])(
    "rejects duplicate %s values",
    (field) => {
      const result = parseEditorialForm(
        form({ ...validDraft, [field]: [validDraft[field as keyof typeof validDraft], "other"] }),
      );

      expect(result).toMatchObject({ ok: false, errors: { [field]: expect.any(String) } });
    },
  );

  it.each([
    "http://example.org/image.jpg",
    "https://user:pass@example.org/image.jpg",
    "//example.org/image.jpg",
    "/\\private",
    "/image\u0000.jpg",
    `https://example.org/${"x".repeat(2030)}`,
  ])("rejects unsafe image URL %j", (imageUrl) => {
    const result = parseEditorialForm(form({ ...validDraft, imageUrl }));

    expect(result).toMatchObject({ ok: false, errors: { imageUrl: expect.any(String) } });
  });
});

describe("parseDocumentForm", () => {
  const validDocument = {
    title: "  Устав фонда  ",
    category: "  Учредительные документы  ",
    fileUrl: "  /documents/charter.pdf  ",
    status: "  ARCHIVED  ",
  };

  it("normalizes a valid document and ignores unknown fields", () => {
    expect(
      expectValid(parseDocumentForm(form({ ...validDocument, ignored: "value" }))),
    ).toEqual({
      title: "Устав фонда",
      category: "Учредительные документы",
      fileUrl: "/documents/charter.pdf",
      status: "ARCHIVED",
    });
  });

  it.each([
    ["title", "Ус\u0000тав"],
    ["category", "Документы\u0085 фонда"],
    ["fileUrl", "/documents/char\u009fter.pdf"],
    ["status", "ARCHIVED\u0000"],
  ])("rejects embedded controls in document %s", (field, value) => {
    const result = parseDocumentForm(form({ ...validDocument, [field]: value }));

    expect(result).toMatchObject({ ok: false, errors: { [field]: expect.any(String) } });
  });

  it.each([
    ["title", "😀", false],
    ["title", "😀".repeat(160), true],
    ["title", "😀".repeat(161), false],
    ["category", "😀", false],
    ["category", "😀".repeat(80), true],
    ["category", "😀".repeat(81), false],
  ] as const)("counts document %s length by code point", (field, value, valid) => {
    const result = parseDocumentForm(form({ ...validDocument, [field]: value }));

    expect(result.ok).toBe(valid);
  });

  it.each([
    ["title", "x"],
    ["title", "x".repeat(161)],
    ["category", "x"],
    ["category", "x".repeat(81)],
    ["fileUrl", ""],
    ["fileUrl", "relative/file.pdf"],
    ["fileUrl", "ftp://example.org/file.pdf"],
    ["status", "DELETED"],
  ])("rejects invalid %s", (field, value) => {
    const result = parseDocumentForm(form({ ...validDocument, [field]: value }));

    expect(result).toMatchObject({ ok: false, errors: { [field]: expect.any(String) } });
  });

  it.each(["title", "category", "fileUrl", "status"])(
    "rejects duplicate %s values",
    (field) => {
      const result = parseDocumentForm(
        form({
          ...validDocument,
          [field]: [validDocument[field as keyof typeof validDocument], "other"],
        }),
      );

      expect(result).toMatchObject({ ok: false, errors: { [field]: expect.any(String) } });
    },
  );
});

describe("publicationTimestamp", () => {
  const firstPublishedAt = new Date("2026-08-01T10:00:00.000Z");
  const now = new Date("2026-08-23T12:00:00.000Z");

  it.each(["DRAFT", "PUBLISHED", "ARCHIVED"] as const)(
    "preserves the first publication date for %s content",
    (status) => {
      expect(publicationTimestamp(status, firstPublishedAt, now)).toBe(firstPublishedAt);
    },
  );

  it("sets the date on first publication", () => {
    expect(publicationTimestamp("PUBLISHED", null, now)).toBe(now);
  });

  it.each(["DRAFT", "ARCHIVED"] as const)(
    "leaves never-published %s content without a date",
    (status) => {
      expect(publicationTimestamp(status, null, now)).toBeNull();
    },
  );
});

describe("parseRequisitesForm", () => {
  const validPublished = {
    version: " 1 ",
    status: " PUBLISHED ",
    fullName: " Фонд «Быть Добру» ",
    shortName: " ФБД ",
    ogrn: " 1257700318974 ",
    inn: " 9721254417 ",
    kpp: " 772101001 ",
    address: " 109462, г. Москва, б-р Волжский, д. 51 ",
    email: " office@example.org ",
    bankName: " АО Банк ",
    recipientName: " Фонд «Быть Добру» ",
    checkingAccount: " 40703810100000000001 ",
    correspondentAccount: " 30101810000000000001 ",
    bik: " 044525001 ",
  };

  it("normalizes a valid published form and ignores unknown fields", () => {
    expect(
      expectValid(parseRequisitesForm(form({ ...validPublished, secret: "hidden" }))),
    ).toEqual({
      version: 1,
      status: "PUBLISHED",
      fullName: "Фонд «Быть Добру»",
      shortName: "ФБД",
      ogrn: "1257700318974",
      inn: "9721254417",
      kpp: "772101001",
      address: "109462, г. Москва, б-р Волжский, д. 51",
      email: "office@example.org",
      bankName: "АО Банк",
      recipientName: "Фонд «Быть Добру»",
      checkingAccount: "40703810100000000001",
      correspondentAccount: "30101810000000000001",
      bik: "044525001",
    });
  });

  it.each(["DRAFT", "ARCHIVED"])(
    "allows empty bank fields for %s requisites",
    (status) => {
      const value = expectValid(
        parseRequisitesForm(
          form({
            ...validPublished,
            status,
            bankName: " ",
            recipientName: "",
            checkingAccount: "",
            correspondentAccount: "",
            bik: "",
          }),
        ),
      );

      expect(value).toMatchObject({ status, bankName: "", checkingAccount: "" });
    },
  );

  it("requires every bank field for published requisites", () => {
    const result = parseRequisitesForm(
      form({
        ...validPublished,
        bankName: "",
        recipientName: "",
        checkingAccount: "",
        correspondentAccount: "",
        bik: "",
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      errors: {
        bankName: expect.any(String),
        recipientName: expect.any(String),
        checkingAccount: expect.any(String),
        correspondentAccount: expect.any(String),
        bik: expect.any(String),
      },
    });
  });

  it.each([
    ["version", "1\u0000"],
    ["status", "DRAFT\u0085"],
    ["fullName", "Фонд\u0000 Добра"],
    ["shortName", "Ф\u0085БД"],
    ["ogrn", "125770\u00000318974"],
    ["inn", "97212\u008554417"],
    ["kpp", "7721\u000001001"],
    ["address", "Москва,\u009f улица Добра"],
    ["email", "office@example\u0000.org"],
    ["bankName", "АО\u0085 Банк"],
    ["recipientName", "Фонд\u0000 Добра"],
    ["checkingAccount", "4070381010\u00850000000001"],
    ["correspondentAccount", "3010181000\u00000000000001"],
    ["bik", "0445\u009f25001"],
  ])("rejects embedded controls in requisites %s", (field, value) => {
    const result = parseRequisitesForm(
      form({ ...validPublished, status: "DRAFT", [field]: value }),
    );

    expect(result).toMatchObject({ ok: false, errors: { [field]: expect.any(String) } });
  });

  it.each([
    "user @example.org",
    "user@ example.org",
    "user@example .org",
    ".user@example.org",
    "user.@example.org",
    "user@.example.org",
    "user@example..org",
    "user@example.org.",
    "user@-example.org",
    "user@example-.org",
    "user@exam_ple.org",
    "user@пример.рф",
    `user@${"a".repeat(64)}.org`,
  ])("rejects malformed requisites email %j", (email) => {
    const result = parseRequisitesForm(
      form({ ...validPublished, status: "DRAFT", email }),
    );

    expect(result).toMatchObject({ ok: false, errors: { email: expect.any(String) } });
  });

  it.each([
    ["a@b", true],
    [`${"a".repeat(248)}@a.com`, true],
    [`${"a".repeat(249)}@a.com`, false],
  ] as const)("enforces requisites email length boundaries", (email, valid) => {
    expect(
      parseRequisitesForm(form({ ...validPublished, status: "DRAFT", email })).ok,
    ).toBe(valid);
  });

  it.each([
    ["fullName", "😀", false],
    ["fullName", "😀".repeat(240), true],
    ["fullName", "😀".repeat(241), false],
    ["shortName", "😀", false],
    ["shortName", "😀".repeat(160), true],
    ["address", "😀".repeat(4), false],
    ["address", "😀".repeat(500), true],
    ["bankName", "😀", false],
    ["bankName", "😀".repeat(200), true],
    ["recipientName", "😀", false],
    ["recipientName", "😀".repeat(240), true],
  ] as const)("counts requisites %s length by code point", (field, value, valid) => {
    const result = parseRequisitesForm(
      form({ ...validPublished, status: "DRAFT", [field]: value }),
    );

    expect(result.ok).toBe(valid);
  });

  it.each([
    ["version", "2"],
    ["status", "published"],
    ["fullName", "x"],
    ["fullName", "x".repeat(241)],
    ["shortName", "x"],
    ["shortName", "x".repeat(161)],
    ["ogrn", "125770031897"],
    ["ogrn", "125770031897x"],
    ["inn", "972125441"],
    ["inn", "972125441x"],
    ["kpp", "77210100"],
    ["kpp", "77210100x"],
    ["address", "x".repeat(4)],
    ["address", "x".repeat(501)],
    ["email", "@example.org"],
    ["email", "user@@example.org"],
    ["email", "x".repeat(255)],
    ["bankName", "x"],
    ["bankName", "x".repeat(201)],
    ["recipientName", "x"],
    ["recipientName", "x".repeat(241)],
    ["checkingAccount", "1".repeat(19)],
    ["checkingAccount", `${"1".repeat(19)}x`],
    ["correspondentAccount", "1".repeat(21)],
    ["bik", "1".repeat(8)],
  ])("rejects invalid %s", (field, value) => {
    const result = parseRequisitesForm(
      form({ ...validPublished, status: "DRAFT", [field]: value }),
    );

    expect(result).toMatchObject({ ok: false, errors: { [field]: expect.any(String) } });
    if (!result.ok) expect(result.errors[field as keyof typeof result.errors]).toMatch(/[А-Яа-яЁё]/);
  });

  it.each(Object.keys(validPublished))("rejects duplicate %s values", (field) => {
    const value = validPublished[field as keyof typeof validPublished];
    const result = parseRequisitesForm(
      form({ ...validPublished, [field]: [value, value] }),
    );

    expect(result).toMatchObject({ ok: false, errors: { [field]: expect.any(String) } });
  });
});

describe("defaultRequisitesDraft", () => {
  it("uses confirmed legal values and empty bank values", () => {
    expect(defaultRequisitesDraft()).toEqual({
      version: 1,
      status: "DRAFT",
      fullName: "Фонд «Быть Добру»",
      shortName: "ФБД",
      ogrn: "1257700318974",
      inn: "9721254417",
      kpp: "772101001",
      address: "109462, г. Москва, б-р Волжский, д. 51, стр. 17, помещ. 101",
      email: "SOROVOI@MAIL.RU",
      bankName: "",
      recipientName: "",
      checkingAccount: "",
      correspondentAccount: "",
      bik: "",
    });
  });
});

describe("parseRequisitesSetting", () => {
  it("roundtrips a valid version 1 setting", () => {
    const value = expectValid(
      parseRequisitesForm(
        form({
          ...defaultRequisitesDraft(),
          version: "1",
          status: "DRAFT",
        }),
      ),
    );

    expect(parseRequisitesSetting(value as Prisma.JsonValue)).toEqual({
      ok: true,
      value,
    });
  });

  it("trims stored string values before validation", () => {
    const stored = { ...defaultRequisitesDraft(), fullName: "  Фонд «Быть Добру»  " };

    expect(parseRequisitesSetting(stored)).toMatchObject({
      ok: true,
      value: { fullName: "Фонд «Быть Добру»" },
    });
  });

  it.each([
    ["fullName", "Фонд\u0000 Добра"],
    ["shortName", "Ф\u0085БД"],
    ["address", "Москва,\u009f улица Добра"],
    ["email", "office@example\u0000.org"],
    ["bankName", "АО\u0085 Банк"],
    ["recipientName", "Фонд\u0000 Добра"],
  ])("rejects embedded controls in stored requisites %s", (field, value) => {
    expect(
      parseRequisitesSetting({ ...defaultRequisitesDraft(), [field]: value }),
    ).toEqual({ ok: false });
  });

  it.each([
    null,
    true,
    1,
    "setting",
    [],
    { ...defaultRequisitesDraft(), version: 2 },
    { ...defaultRequisitesDraft(), status: "published" },
    { ...defaultRequisitesDraft(), inn: 9721254417 },
    { ...defaultRequisitesDraft(), email: "invalid" },
    { ...defaultRequisitesDraft(), extra: "field" },
    Object.fromEntries(
      Object.entries(defaultRequisitesDraft()).filter(([field]) => field !== "bik"),
    ),
  ] as Prisma.JsonValue[])("rejects malformed runtime JSON %#", (value) => {
    expect(parseRequisitesSetting(value)).toEqual({ ok: false });
  });
});
