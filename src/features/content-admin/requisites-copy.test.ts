import { describe, expect, it } from "vitest";

import type { RequisitesInput } from "./types";
import { formatPublishedRequisitesCopy } from "./requisites-copy";

const published: RequisitesInput = {
  version: 1,
  status: "PUBLISHED",
  fullName: "Благотворительный фонд «Проверенные реквизиты»",
  shortName: "БФ «ПР»",
  ogrn: "1234567890123",
  inn: "1234567890",
  kpp: "123456789",
  address: "г. Москва, ул. Проверенная, д. 1",
  email: "VERIFIED@EXAMPLE.ORG",
  bankName: "Проверенный банк",
  recipientName: "БФ «ПР»",
  checkingAccount: "40703810000000000001",
  correspondentAccount: "30101810000000000001",
  bik: "044525001",
};

describe("formatPublishedRequisitesCopy", () => {
  it("formats legal and bank rows as plain text with a lowercase email", () => {
    const text = formatPublishedRequisitesCopy(published);

    expect(text).toContain("ОГРН: 1234567890123");
    expect(text).toContain("Email: verified@example.org");
    expect(text).toContain("Расчетный счет: 40703810000000000001");
    expect(text).toContain("БИК: 044525001");
    expect(text).not.toContain("VERIFIED@EXAMPLE.ORG");
  });
});
