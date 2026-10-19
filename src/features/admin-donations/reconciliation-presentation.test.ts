import { describe, expect, it } from "vitest";
import { reconciliationMessage } from "./reconciliation-presentation";

describe("payment reconciliation messages", () => {
  it("explains legacy method rejections and provider protocol failures", () => {
    expect(reconciliationMessage("payment_method_mismatch", true)).toContain("Повторите проверку");
    expect(reconciliationMessage("payment_provider_protocol")).toContain("ответ ЮKassa");
  });
});
