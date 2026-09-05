import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { put } from "@vercel/blob";

import {
  putS3Object,
  readObjectStoreConfig,
  type ObjectStoreConfig,
  type PutObjectInput,
} from "./object-store";
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
  isProduction?: boolean;
  objectStore?: ObjectStoreConfig;
  putObject?: (input: PutObjectInput) => Promise<StoredUpload>;
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
  const onVercel = dependencies.onVercel ?? process.env.VERCEL === "1";
  const isProduction =
    dependencies.isProduction ?? process.env.NODE_ENV === "production";
  const objectStore = dependencies.objectStore ?? readObjectStoreConfig();
  const putBlob = dependencies.putBlob ?? put;
  const putObject =
    dependencies.putObject ??
    ((input: PutObjectInput) => {
      if (!objectStore) {
        return Promise.reject(new UploadStorageUnavailableError());
      }
      return putS3Object(objectStore, input);
    });

  if (objectStore) {
    try {
      return await putObject({
        pathname,
        bytes,
        contentType: detected.contentType,
      });
    } catch {
      throw new UploadStorageUnavailableError();
    }
  }

  if (blobToken) {
    const blob = await putBlob(pathname, Buffer.from(bytes), {
      access: "public",
      addRandomSuffix: false,
      contentType: detected.contentType,
      token: blobToken,
    });

    return { url: blob.url };
  }

  if (onVercel || isProduction) {
    throw new UploadStorageUnavailableError();
  }

  const cwd = dependencies.cwd ?? process.cwd();
  const absolutePath = join(cwd, "public", pathname);
  const writeLocal = dependencies.writeLocal ?? writeLocalFile;
  await writeLocal(absolutePath, bytes);

  return { url: `/${pathname}` };
}
