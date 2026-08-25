import { createHmac } from "node:crypto";
import { isIP } from "node:net";

type HeaderReader = Pick<Headers, "get">;

type PaymentClientKeyInput = {
  headers: HeaderReader;
  secret: string;
  trustProxy: boolean;
  environment: string | undefined;
};

function canonicalizeIpv6(address: string): string {
  return new URL(`http://[${address}]/`).hostname.slice(1, -1);
}

export function normalizeClientAddress(
  address: string | null | undefined,
): string {
  const trimmed = address?.trim();

  if (!trimmed) {
    return "unknown";
  }

  const version = isIP(trimmed);

  if (version === 4) {
    return trimmed.split(".").map(Number).join(".");
  }

  if (version === 6) {
    try {
      return canonicalizeIpv6(trimmed);
    } catch {
      return "unknown";
    }
  }

  return "unknown";
}

export function createPaymentClientKey({
  environment,
  headers,
  secret,
  trustProxy,
}: PaymentClientKeyInput): string {
  let clientAddress = "local";
  const isLocalEnvironment =
    environment === "development" || environment === "test";

  if (!isLocalEnvironment) {
    if (!trustProxy) {
      clientAddress = "unknown";
    } else {
      const forwardedFor = headers.get("x-forwarded-for");
      const selectedAddress =
        forwardedFor === null
          ? headers.get("x-real-ip")
          : forwardedFor.split(",", 1)[0];
      clientAddress = normalizeClientAddress(selectedAddress);
    }
  }

  return createHmac("sha256", secret).update(clientAddress).digest("hex");
}
