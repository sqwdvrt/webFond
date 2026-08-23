import { createHmac } from "node:crypto";

type HeaderReader = {
  get(name: string): string | null;
};

function trustedClientAddress(headers: HeaderReader) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  if (forwarded) {
    return forwarded;
  }

  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function createClientKey(input: {
  headers: HeaderReader;
  secret: string;
  trustProxy: boolean;
  environment: string | undefined;
}) {
  const source =
    input.environment === "production"
      ? input.trustProxy
        ? trustedClientAddress(input.headers)
        : "unknown"
      : "local";

  return createHmac("sha256", input.secret).update(source, "utf8").digest("hex");
}
