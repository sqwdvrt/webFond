import { describe, expect, it } from "vitest";

import {
  buildOperationalAlerts,
  staleContactCutoff,
  staleDonationCutoff,
} from "./alerts";

describe("operational alert cutoffs", () => {
  const now = new Date("2026-10-16T12:34:56.789Z");

  it("subtracts exactly 48 hours for stale contacts", () => {
    const cutoff = staleContactCutoff(now);
    const exactBoundary = new Date("2026-10-14T12:34:56.789Z");
    const oneMillisecondOlder = new Date("2026-10-14T12:34:56.788Z");

    expect(cutoff).toEqual(exactBoundary);
    expect(exactBoundary.getTime() < cutoff.getTime()).toBe(false);
    expect(oneMillisecondOlder.getTime() < cutoff.getTime()).toBe(true);
  });

  it("subtracts exactly one hour for stale donations", () => {
    const cutoff = staleDonationCutoff(now);
    const exactBoundary = new Date("2026-10-16T11:34:56.789Z");
    const oneMillisecondOlder = new Date("2026-10-16T11:34:56.788Z");

    expect(cutoff).toEqual(exactBoundary);
    expect(exactBoundary.getTime() < cutoff.getTime()).toBe(false);
    expect(oneMillisecondOlder.getTime() < cutoff.getTime()).toBe(true);
  });
});

describe("buildOperationalAlerts", () => {
  it.each([null, new Date("2026-10-16T12:19:56.788Z")])("warns on an absent or older-than-15-minute enabled heartbeat: %s", (completedAt) => {
    expect(buildOperationalAlerts({ staleNewContactCount: 0, stalePendingDonationCount: 0, readinessIssues: [], now: new Date("2026-10-16T12:34:56.789Z"), reconciliation: { enabled: true, completedAt, failed: 0 } })).toContainEqual(expect.objectContaining({ code: "PAYMENTS_RECONCILIATION_STALE" }));
  });

  it("does not warn when disabled or exactly at the 15-minute boundary", () => {
    for (const reconciliation of [{ enabled: false, completedAt: null, failed: null }, { enabled: true, completedAt: new Date("2026-10-16T12:19:56.789Z"), failed: 0 }]) {
      expect(buildOperationalAlerts({ staleNewContactCount: 0, stalePendingDonationCount: 0, readinessIssues: [], now: new Date("2026-10-16T12:34:56.789Z"), reconciliation })).toEqual([]);
    }
  });
  it("returns no alerts when all aggregate checks are healthy", () => {
    expect(
      buildOperationalAlerts({
        staleNewContactCount: 0,
        stalePendingDonationCount: 0,
        readinessIssues: [],
      }),
    ).toEqual([]);
  });

  it("builds safe alerts in deterministic operational order", () => {
    expect(
      buildOperationalAlerts({
        staleNewContactCount: 3,
        now: new Date("2026-10-16T12:34:56.789Z"),
        stalePendingDonationCount: 2,
        readinessIssues: ["ADMIN_AUTH"],
      }),
    ).toEqual([
      {
        code: "ADMIN_CONFIGURATION",
        severity: "warning",
        message: "Обнаружена проблема конфигурации административной части.",
        href: "/api/ready",
      },
      {
        code: "STALE_PENDING_DONATIONS",
        severity: "warning",
        message: "Ожидающих пожертвований старше часа: 2.",
        href: "/admin/donations?status=PENDING&stale=1",
      },
      {
        code: "STALE_NEW_CONTACTS",
        severity: "warning",
        message: "Новых обращений старше 48 часов: 3.",
        href: "/admin/messages?status=NEW&before=2026-10-14T12%3A34%3A56.789Z",
      },
    ]);
  });

  it("does not embed records or configuration details in messages", () => {
    const alerts = buildOperationalAlerts({
      staleNewContactCount: 1,
      stalePendingDonationCount: 1,
      readinessIssues: ["ADMIN_AUTH"],
    });
    const serialized = JSON.stringify(alerts);

    expect(serialized).not.toContain("email");
    expect(serialized).not.toContain("AUTH_SECRET");
    expect(serialized).not.toContain("ADMIN_USERNAME");
    expect(serialized).not.toContain("ADMIN_AUTH");
    expect(serialized).not.toContain("private@example.test");
  });

  it("ignores invalid aggregate counts", () => {
    expect(
      buildOperationalAlerts({
        staleNewContactCount: -1,
        stalePendingDonationCount: Number.NaN,
        readinessIssues: [],
      }),
    ).toEqual([]);
  });
});
