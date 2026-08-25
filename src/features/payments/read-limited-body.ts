export type LimitedBodyResult =
  | { kind: "ok"; bytes: Uint8Array }
  | { kind: "too-large" };

export async function readLimitedBody(
  request: Request,
  limit: number,
): Promise<LimitedBodyResult> {
  const reader = request.body?.getReader();
  if (!reader) {
    return { kind: "ok", bytes: new Uint8Array() };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        return { kind: "too-large" };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { kind: "ok", bytes };
}
