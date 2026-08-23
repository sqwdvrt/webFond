import axe from "axe-core";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const formPath = resolve(
  process.cwd(),
  "src/app/admin/login/login-form.tsx",
);

describe("admin login accessibility", () => {
  it("has a named heading, fields, action, and no high-impact violations", async () => {
    expect(existsSync(formPath)).toBe(true);
    const importPath = "./login/login-form";
    const { LoginForm } = (await import(
      /* @vite-ignore */ importPath
    )) as typeof import("./login/login-form");
    const action = async () => ({ status: "idle" as const, message: "" });
    const { container } = render(<LoginForm action={action} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Вход в административную часть",
    );
    expect(screen.getByRole("textbox", { name: "Логин" })).toBeRequired();
    expect(screen.getByLabelText("Пароль")).toBeRequired();
    expect(screen.getByRole("button", { name: "Войти" })).toBeEnabled();

    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(
      results.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      ),
    ).toEqual([]);
  });
});
