import { describe, expect, it, vi } from "vitest";

import { submitContact, type ContactFormState, type SubmitContactDependencies } from "./submit";

const idle: ContactFormState = { status: "idle", message: "" };

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

function dependencies(
  save: SubmitContactDependencies["save"] = async () => "ok",
): SubmitContactDependencies {
  return {
    headers: new Headers(),
    now: new Date("2026-08-28T09:00:00.000Z"),
    environment: "test",
    secret: "contact-rate-limit-test-secret-key-32",
    trustProxy: false,
    save,
  };
}

describe("submitContact", () => {
  it("saves a valid message", async () => {
    const save = vi.fn(
      async (): Promise<"ok" | "rate-limited"> => "ok",
    );
    const result = await submitContact(idle, form(valid), dependencies(save));

    expect(save).toHaveBeenCalledOnce();
    expect(result).toEqual({
      status: "success",
      message: "Сообщение получили. Ответим на указанную почту.",
    });
  });

  it("returns success for a bot without saving", async () => {
    const save = vi.fn(async () => "ok" as const);
    const result = await submitContact(
      idle,
      form({ ...valid, website: "http://bots.test" }),
      dependencies(save),
    );

    expect(save).not.toHaveBeenCalled();
    expect(result.status).toBe("success");
  });

  it("returns field errors without saving", async () => {
    const save = vi.fn(async () => "ok" as const);
    const result = await submitContact(
      idle,
      form({ ...valid, email: "bad" }),
      dependencies(save),
    );

    expect(save).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "error",
      errors: { email: expect.any(String) },
    });
  });

  it("maps a rate limit to a public retry message", async () => {
    const result = await submitContact(
      idle,
      form(valid),
      dependencies(vi.fn(async (): Promise<"ok" | "rate-limited"> => "rate-limited")),
    );

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/подождите/i);
  });
});
