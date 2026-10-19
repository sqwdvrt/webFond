import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderHomePage } from "@/app/page";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { homepageHelpGroups } from "@/content/projects";
import { siteConfig } from "@/config/site";

const HomePage = () => renderHomePage({ paymentsEnabled: () => false });

describe("HomePage", () => {
  it("keeps legal facts and help available when both evidence sources fail", () => {
    render(renderHomePage({ paymentsEnabled: () => false, evidence: { documents: null, projects: null } }));
    expect(screen.getByText(siteConfig.legal.ogrn)).toBeVisible();
    expect(screen.getByText(siteConfig.legal.inn)).toBeVisible();
    expect(screen.getByRole("link", { name: "Полные реквизиты фонда" })).toHaveAttribute("href", "/requisites");
    expect(screen.getByRole("link", { name: "Цели использования пожертвований в оферте" })).toHaveAttribute("href", "/donation-offer");
    expect(screen.getByRole("link", { name: "Нужна помощь" })).toHaveAttribute("href", "/need-help");
    expect(screen.getByText("Не удалось загрузить проекты.")).toBeVisible();
    expect(screen.getByText("Не удалось загрузить отчёты.")).toBeVisible();
  });

  it("explains the mission and offers separate paths for donors and applicants", () => {
    render(<HomePage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Помогаем людям в трудной жизненной ситуации");
    expect(screen.getByRole("link", { name: "Помочь фонду" })).toHaveAttribute("href", "/help");
    expect(screen.getByRole("link", { name: "Нужна помощь" })).toHaveAttribute("href", "/need-help");
    expect(screen.getByRole("link", { name: "Написать через форму" })).toHaveAttribute("href", siteConfig.contacts.formHref);
    for (const group of homepageHelpGroups) {
      expect(screen.getByRole("heading", { name: group.title })).toBeVisible();
    }
  });

  it("keeps empty collections out of the homepage and legal details available", () => {
    const { container } = render(<HomePage />);
    expect(screen.queryByRole("heading", { name: "Проекты и отчётность" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Отчёты фонда" })).toHaveAttribute("href", "/reports");
    expect(container.querySelectorAll(".section-number")).toHaveLength(0);
    expect(container.querySelectorAll("ol.help-steps > li")).toHaveLength(3);
    expect(screen.getByText(/17 июля 2025 года/)).toBeVisible();
    expect(screen.queryByText(/пока не опубликованы/)).not.toBeInTheDocument();
  });

  it("puts published work before donation and renders only available collections", () => {
    render(renderHomePage({ paymentsEnabled: () => true, evidence: {
      projects: [{ id: "project", slug: "real", title: "Опубликованный проект", summary: "Реальная работа", imageUrl: null, publishedAt: null, fundraising: null }],
      documents: [],
    } }));
    const work = screen.getByRole("heading", { name: "Проекты и отчётность" });
    const help = screen.getByRole("heading", { name: "Как помочь" });
    expect(work.compareDocumentPosition(help)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByRole("link", { name: "Опубликованный проект" })).toHaveAttribute("href", "/projects/real");
    expect(screen.queryByRole("heading", { name: "Отчёты и документы" })).not.toBeInTheDocument();
  });

  it("describes help without emphasizing payment periodicity", () => {
    const { container } = render(<><SiteHeader /><main><HomePage /></main><SiteFooter /></>);
    expect(container.textContent?.toLowerCase()).not.toMatch(/разов|единоврем|подпис|автоспис/);
  });

  it.each(["disabled", "configuration-error"])("offers bank transfer when payments are %s", (state) => {
    const { container } = render(renderHomePage({ paymentsEnabled: () => {
      if (state === "configuration-error") throw new Error("private config");
      return false;
    } }));
    expect(screen.getByText("Поддержать фонд можно банковским переводом.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Перейти к переводу" })).toHaveAttribute("href", "/help");
    expect(container.textContent).not.toMatch(/подключается|скоро|недоступна|private config/);
  });

  it("shows the live payment path when payments are enabled", () => {
    render(renderHomePage({ paymentsEnabled: () => true }));
    expect(screen.getByText("Можно поддержать фонд онлайн или по банковским реквизитам.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Перейти к оплате" })).toHaveAttribute("href", "/help");
  });
});
