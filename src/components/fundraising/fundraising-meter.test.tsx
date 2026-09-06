import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FundraisingMeter } from "./fundraising-meter";
import { formatFundraisingAmount } from "@/features/fundraising/progress";

const progress = {
  collectedKopecks: 125_887_500,
  goalKopecks: 600_000_000,
  fillPercent: 20.98,
};

describe("FundraisingMeter", () => {
  it("renders collected and goal amounts with a sized progress bar and help link", () => {
    const collected = formatFundraisingAmount(progress.collectedKopecks);
    const goal = formatFundraisingAmount(progress.goalKopecks);

    render(
      <FundraisingMeter
        helpHref="/help?project=published-project"
        progress={progress}
      />,
    );

    expect(screen.getByText("собрали")).toBeVisible();
    expect(screen.getByText("нужно")).toBeVisible();
    expect(
      screen.getByText((_, node) => node?.tagName === "STRONG" && node.textContent === collected),
    ).toBeVisible();
    expect(
      screen.getByText((_, node) => node?.tagName === "STRONG" && node.textContent === goal),
    ).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-label",
      `Собрано ${collected} из ${goal}`,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "21");
    expect(document.querySelector(".fundraising-meter-fill")).toHaveStyle({
      width: "20.98%",
    });
    expect(screen.getByRole("link", { name: "Помочь" })).toHaveAttribute(
      "href",
      "/help?project=published-project",
    );
  });
});
