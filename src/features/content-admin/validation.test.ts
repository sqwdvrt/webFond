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
