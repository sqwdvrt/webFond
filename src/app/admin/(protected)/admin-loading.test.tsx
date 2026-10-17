import axe from "axe-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AdminLoading from "./admin-loading";
import ProtectedLoading from "./loading";
import MessagesLoading from "./messages/loading";

const privateMarkers = /password=secret|database\.internal|private-token/i;

describe("protected admin loading states", () => {
  it.each([
    ["shared", AdminLoading],
    ["protected route", ProtectedLoading],
    ["messages route", MessagesLoading],
  ])("renders an accessible neutral %s state", async (_name, Loading) => {
    const { container } = render(<Loading />);

    expect(screen.getByRole("heading", { name: "Загрузка данных" })).toBeVisible();
    expect(screen.getByText("Загрузка данных…")).toBeVisible();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(container).not.toHaveTextContent(/\d/);
    expect(container).not.toHaveTextContent(privateMarkers);

    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(
      results.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      ),
    ).toEqual([]);
  });

  it("reuses the shared component in both route boundaries", () => {
    for (const path of [
      "src/app/admin/(protected)/loading.tsx",
      "src/app/admin/(protected)/messages/loading.tsx",
    ]) {
      const source = readFileSync(resolve(process.cwd(), path), "utf8");

      expect(source).toMatch(/import AdminLoading from/);
      expect(source).toContain("<AdminLoading />");
    }
  });
});
