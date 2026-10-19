export type ReconcileRequest = { mode: "batch"; limit: number } | { mode: "single"; donationId: string };

export function parseReconcileRequest(value: unknown): ReconcileRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (input.mode === "single") {
    if (typeof input.donationId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.donationId)) return null;
    return { mode: "single", donationId: input.donationId };
  }
  if (input.mode !== undefined && input.mode !== "batch") return null;
  const limit = input.limit === undefined ? 25 : input.limit;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 100) return null;
  return { mode: "batch", limit };
}
