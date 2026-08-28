import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { put } from "@vercel/blob";

import type { DetectedUpload, UploadKind } from "./validate";

export class UploadStorageUnavailableError extends Error {
  constructor() {
    super("Upload storage is unavailable");
    this.name = "UploadStorageUnavailableError";
  }
}

export type StoredUpload = {
  url: string;
};

export type StoreUploadInput = {
  bytes: Uint8Array;
  detected: DetectedUpload;
  kind: UploadKind;
};

export type StoreUploadDependencies = {
  blobToken?: string;
  onVercel?: boolean;
  putBlob?: typeof put;
  writeLocal?: (path: string, bytes: Uint8Array) => Promise<void>;
  cwd?: string;
};

async function writeLocalFile(path: string, bytes: Uint8Array) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

export async function storeUpload(
  { bytes, detected, kind }: StoreUploadInput,
  dependencies: StoreUploadDependencies = {},
): Promise<StoredUpload> {
  const filename = `${randomUUID()}.${detected.extension}`;
  const pathname = `uploads/${kind}/${filename}`;
  const blobToken = dependencies.blobToken ?? process.env.BLOB_READ_WRITE_TOKEN;
  const onVercel =
    dependencies.onVercel ?? process.env.VERCEL === "1";
  const putBlob = dependencies.putBlob ?? put;

  if (blobToken) {
    const blob = await putBlob(pathname, Buffer.from(bytes), {
      access: "public",
      addRandomSuffix: false,
      contentType: detected.contentType,
      token: blobToken,
    });

    return { url: blob.url };
  }

  if (onVercel) {
    throw new UploadStorageUnavailableError();
  }

  const cwd = dependencies.cwd ?? process.cwd();
  const absolutePath = join(cwd, "public", pathname);
  const writeLocal = dependencies.writeLocal ?? writeLocalFile;
  await writeLocal(absolutePath, bytes);

  return { url: `/${pathname}` };
}
