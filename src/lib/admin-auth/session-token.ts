import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_DURATION_SECONDS = 8 * 60 * 60;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export type AdminSessionPayload = {
  version: 1;
  username: string;
  issuedAt: number;
  expiresAt: number;
};

function signatureFor(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload, "utf8").digest();
}

function decodeBase64Url(value: string) {
  if (!BASE64URL_PATTERN.test(value)) {
    return null;
  }

  const decoded = Buffer.from(value, "base64url");
  return decoded.toString("base64url") === value ? decoded : null;
}

function isAdminSessionPayload(
  value: unknown,
  username: string,
  now: number,
): value is AdminSessionPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<AdminSessionPayload>;
  return (
    payload.version === 1 &&
    payload.username === username &&
    Number.isInteger(payload.issuedAt) &&
    Number.isInteger(payload.expiresAt) &&
    payload.issuedAt! < payload.expiresAt! &&
    payload.expiresAt! > now
  );
}

export function createSessionToken(input: {
  username: string;
  secret: string;
  now: number;
}) {
  const payload: AdminSessionPayload = {
    version: 1,
    username: input.username,
    issuedAt: input.now,
    expiresAt: input.now + SESSION_DURATION_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = signatureFor(encodedPayload, input.secret).toString(
    "base64url",
  );

  return { token: `${encodedPayload}.${signature}`, payload };
}

export function verifySessionToken(input: {
  token: string;
  username: string;
  secret: string;
  now: number;
}): AdminSessionPayload | null {
  const parts = input.token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, encodedSignature] = parts;
  const suppliedSignature = decodeBase64Url(encodedSignature);
  const expectedSignature = signatureFor(encodedPayload, input.secret);

  if (
    !suppliedSignature ||
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    return null;
  }

  const payloadBuffer = decodeBase64Url(encodedPayload);

  if (!payloadBuffer) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(payloadBuffer.toString("utf8"));
    return isAdminSessionPayload(payload, input.username, input.now)
      ? payload
      : null;
  } catch {
    return null;
  }
}
