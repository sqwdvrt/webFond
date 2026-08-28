import { describe, expect, it } from "vitest";

import { parseContactForm } from "./validation";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    data.set(name, value);
  }
  return data;
}

const valid = {
  name: "Анна Иванова",
  email: "anna@example.org",
  message: "Хочу узнать, как помочь фонду документами.",
  website: "",
};

describe("parseContactForm", () => {
  it("accepts a complete human message", () => {
    expect(parseContactForm(form(valid))).toEqual({
      kind: "valid",
      value: {
        name: "Анна Иванова",
        email: "anna@example.org",
        message: "Хочу узнать, как помочь фонду документами.",
      },
    });
  });

  it("treats a filled honeypot as a bot without leaking field errors", () => {
    expect(
      parseContactForm(form({ ...valid, website: "https://spam.example" })),
    ).toEqual({ kind: "bot" });
  });

  it("rejects a short name, invalid email and a too short message", () => {
    const result = parseContactForm(
      form({ name: "А", email: "not-mail", message: "Привет", website: "" }),
    );

    expect(result).toMatchObject({
      kind: "invalid",
      errors: {
        name: expect.any(String),
        email: expect.any(String),
        message: expect.any(String),
      },
    });
  });
});
