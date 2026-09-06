import { describe, expect, it, vi } from "vitest";

import { sumSucceededDonationKopecksByProjectId } from "./totals";

describe("sumSucceededDonationKopecksByProjectId", () => {
  it("returns an empty map without querying when there are no project ids", async () => {
    const groupBy = vi.fn();

    await expect(
      sumSucceededDonationKopecksByProjectId([], {
        donation: { groupBy },
      }),
    ).resolves.toEqual(new Map());
    expect(groupBy).not.toHaveBeenCalled();
  });

  it("sums only succeeded donations grouped by project id", async () => {
    const groupBy = vi.fn(async () => [
      { projectId: "project-a", _sum: { amountKopecks: 12_500 } },
      { projectId: "project-b", _sum: { amountKopecks: null } },
    ]);

    await expect(
      sumSucceededDonationKopecksByProjectId(["project-a", "project-b"], {
        donation: { groupBy },
      }),
    ).resolves.toEqual(
      new Map([
        ["project-a", 12_500],
        ["project-b", 0],
      ]),
    );
    expect(groupBy).toHaveBeenCalledExactlyOnceWith({
      by: ["projectId"],
      where: {
        status: "SUCCEEDED",
        projectId: { in: ["project-a", "project-b"] },
      },
      _sum: { amountKopecks: true },
    });
  });
});
