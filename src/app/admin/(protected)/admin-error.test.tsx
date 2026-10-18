import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";

import AdminError from "./error";

describe("protected admin error boundary", () => {
  it("is an accessible typed client boundary with a privacy-safe retry action", async () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/admin/(protected)/error.tsx"),
      "utf8",
    );
    const reset = vi.fn();
    const user = userEvent.setup();
    const privateMarkers = [
      "message-private-marker",
      "digest-private-marker",
      "query-private-marker",
      "token-private-marker",
    ];
    const error = Object.assign(new Error(privateMarkers[0]), {
      digest: privateMarkers[1],
      query: privateMarkers[2],
      privateToken: privateMarkers[3],
    });

    expect(source.startsWith('"use client";')).toBe(true);
    expect(source).toContain("error: Error & { digest?: string }");
    expect(source).toContain("reset: () => void");

    const { container } = render(<AdminError error={error} reset={reset} />);

    expect(screen.getByRole("heading")).toHaveTextContent(
      "Не удалось загрузить раздел",
    );
    for (const marker of privateMarkers) {
      expect(container).not.toHaveTextContent(marker);
    }

    const retry = screen.getByRole("button", { name: "Повторить" });
    await user.tab();
    expect(retry).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(reset).toHaveBeenCalledOnce();

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
