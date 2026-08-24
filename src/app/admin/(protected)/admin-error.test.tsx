import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AdminError from "./error";

describe("protected admin error boundary", () => {
  it("is a typed client boundary with a neutral retry action", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/admin/(protected)/error.tsx"),
      "utf8",
    );
    const reset = vi.fn();

    expect(source.startsWith('"use client";')).toBe(true);
    expect(source).toContain("error: Error & { digest?: string }");
    expect(source).toContain("reset: () => void");

    render(
      <AdminError
        error={new Error("password=secret host=database.internal")}
        reset={reset}
      />,
    );

    expect(screen.getByRole("heading")).toHaveTextContent(
      "Не удалось загрузить раздел",
    );
    expect(screen.queryByText(/password=secret|database\.internal/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
