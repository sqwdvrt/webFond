import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeEvidence } from "./home-evidence";

const document = { id: "report", title: "Годовой отчет", category: "Отчетность", fileUrl: "https://files.example.org/report.pdf", publishedAt: new Date("2026-09-01T12:00:00Z"), updatedAt: new Date("2026-10-01T12:00:00Z") };
const project = { id: "project", slug: "real-project", title: "Реальный проект", summary: "Описание проекта", imageUrl: null, publishedAt: new Date("2026-09-01T12:00:00Z"), fundraising: { collectedKopecks: 500_000, goalKopecks: 1_000_000, fillPercent: 50 } };

describe("HomeEvidence", () => {
  it("shows source dates, actual amounts and links without a made-up completion status", () => {
    const { container } = render(<HomeEvidence data={{ documents: [document], projects: [project] }} />);
    expect(screen.getByRole("link", { name: "Годовой отчет" })).toHaveAttribute("href", document.fileUrl);
    expect(screen.getByRole("link", { name: "Годовой отчет" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(container.querySelector('time[datetime="2026-10-01T12:00:00.000Z"]')).toBeInTheDocument();
    expect(screen.getByText(/Документ обновлён/)).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByRole("link", { name: "Реальный проект" })).toHaveAttribute("href", "/projects/real-project");
    expect(screen.getByRole("link", { name: "Помочь" })).toHaveAttribute("href", "/help?project=real-project");
    expect(screen.queryByText(/завершён|завершен/i)).not.toBeInTheDocument();
  });
  it("does not invent amounts for a project without a goal", () => {
    render(<HomeEvidence data={{ documents: [], projects: [{ ...project, fundraising: null }] }} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Реальный проект" })).toBeVisible();
    expect(screen.getByText("Отчёты пока не опубликованы.")).toBeVisible();
  });
  it("keeps the surviving collection on a failed read", () => {
    render(<HomeEvidence data={{ documents: null, projects: [project] }} />);
    expect(screen.getByText("Не удалось загрузить отчёты.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Реальный проект" })).toBeVisible();
  });
  it("shows empty projects and leaves the reports link available", () => {
    render(<HomeEvidence data={{ documents: [], projects: [] }} />);
    expect(screen.getByText("Проекты пока не опубликованы.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Все отчёты и документы" })).toHaveAttribute("href", "/reports");
  });
});
