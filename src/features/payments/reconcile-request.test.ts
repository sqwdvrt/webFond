import { describe, expect, it } from "vitest";
import { parseReconcileRequest } from "./reconcile-request";

describe("reconcile command", () => {
  it.each([null, [], 1, { limit: -1 }, { limit: 1.5 }, { limit: NaN }, { limit: 101 }, { mode: "other" }, { mode: "single", donationId: "../" }])("rejects malformed command %j", (input) => {
    expect(parseReconcileRequest(input)).toBeNull();
  });
  it("accepts legacy bounded batch requests and a selected local donation", () => {
    expect(parseReconcileRequest({ limit: 10 })).toEqual({ mode: "batch", limit: 10 });
    expect(parseReconcileRequest({ mode: "single", donationId: "donation-1" })).toEqual({ mode: "single", donationId: "donation-1" });
  });
});
