import { describe, expect, it } from "vitest";

import {
  formatFundraisingAmount,
  fundraisingProgress,
} from "./progress";

describe("fundraisingProgress", () => {
  it("hides the meter when a goal is missing or not positive", () => {
    expect(
      fundraisingProgress({
        goalAmountKopecks: null,
        onlineSucceededKopecks: 10_000,
        manualRaisedKopecks: 5_000,
      }),
    ).toBeNull();
    expect(
      fundraisingProgress({
        goalAmountKopecks: 0,
        onlineSucceededKopecks: 0,
        manualRaisedKopecks: 0,
      }),
    ).toBeNull();
    expect(
      fundraisingProgress({
        goalAmountKopecks: -100,
        onlineSucceededKopecks: 0,
        manualRaisedKopecks: 0,
      }),
    ).toBeNull();
  });

  it("sums online succeeded payments with the admin manual amount", () => {
    expect(
      fundraisingProgress({
        goalAmountKopecks: 600_000_000,
        onlineSucceededKopecks: 100_000_000,
        manualRaisedKopecks: 25_887_500,
      }),
    ).toEqual({
      collectedKopecks: 125_887_500,
      goalKopecks: 600_000_000,
      fillPercent: 20.98,
    });
  });

  it("keeps a zero fill when nothing has been raised toward a goal", () => {
    expect(
      fundraisingProgress({
        goalAmountKopecks: 1_000_00,
        onlineSucceededKopecks: 0,
        manualRaisedKopecks: 0,
      }),
    ).toEqual({
      collectedKopecks: 0,
      goalKopecks: 100_000,
      fillPercent: 0,
    });
  });

  it("caps the fill at 100 percent while keeping the real collected amount", () => {
    expect(
      fundraisingProgress({
        goalAmountKopecks: 100_000,
        onlineSucceededKopecks: 80_000,
        manualRaisedKopecks: 40_000,
      }),
    ).toEqual({
      collectedKopecks: 120_000,
      goalKopecks: 100_000,
      fillPercent: 100,
    });
  });
});

describe("formatFundraisingAmount", () => {
  it("formats whole roubles without a fractional part", () => {
    expect(formatFundraisingAmount(125_887_500)).toBe("1 258 875 ₽");
    expect(formatFundraisingAmount(0)).toBe("0 ₽");
  });
});
