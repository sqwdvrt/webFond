import { createHash, createHmac } from "node:crypto";

export type ObjectStoreConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  publicBaseUrl: string;
};

export type PutObjectInput = {
  pathname: string;
  bytes: Uint8Array;
  contentType: string;
};

export class ObjectStoreRequestError extends Error {
  constructor(status: number) {
    super(`Object store rejected upload (${status})`);
    this.name = "ObjectStoreRequestError";
  }
}

function sha256Hex(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function amzDateParts(now: Date) {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

export function readObjectStoreConfig(
  env: NodeJS.Dict<string | undefined> = process.env,
): ObjectStoreConfig | undefined {
  const endpoint = env.S3_ENDPOINT?.trim();
  const region = env.S3_REGION?.trim();
  const bucket = env.S3_BUCKET?.trim();
  const accessKey = env.S3_ACCESS_KEY?.trim();
  const secretKey = env.S3_SECRET_KEY?.trim();
  const publicBaseUrl = env.S3_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");

  if (!endpoint || !region || !bucket || !accessKey || !secretKey || !publicBaseUrl) {
    return undefined;
  }

  return { endpoint, region, bucket, accessKey, secretKey, publicBaseUrl };
}

export async function putS3Object(
  config: ObjectStoreConfig,
  input: PutObjectInput,
  dependencies: { fetchImpl?: typeof fetch; now?: () => Date } = {},
): Promise<{ url: string }> {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const { amzDate, dateStamp } = amzDateParts(dependencies.now?.() ?? new Date());
  const key = input.pathname.replace(/^\/+/, "");
  const url = new URL(`/${config.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`, config.endpoint);
  const payloadHash = sha256Hex(input.bytes);
  const canonicalHeaders = [
    `content-type:${input.contentType}`,
    `host:${url.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
    "",
  ].join("\n");
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${config.secretKey}`, dateStamp), config.region), "s3"),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  const response = await fetchImpl(url, {
    method: "PUT",
    headers: {
      "Content-Type": input.contentType,
      Host: url.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body: Buffer.from(input.bytes),
  });

  if (!response.ok) {
    throw new ObjectStoreRequestError(response.status);
  }

  return { url: `${config.publicBaseUrl}/${key}` };
}
