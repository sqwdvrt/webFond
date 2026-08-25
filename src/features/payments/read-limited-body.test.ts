import { describe, expect, it, vi } from "vitest";

import { readLimitedBody } from "./read-limited-body";

function chunkedRequest(chunks: Uint8Array[], extra?: RequestInit): Request {
  let index = 0;
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(chunks[index]);
      index += 1;
    },
    cancel,
  });

  const request = new Request("https://example.org/api/payments/create", {
    method: "POST",
    body,
    ...extra,
    // @ts-expect-error Node Request duplex is required for streaming bodies.
    duplex: "half",
  });

  return Object.assign(request, { cancel });
}

describe("readLimitedBody", () => {
  it("concatenates chunks at the exact limit", async () => {
    const first = new Uint8Array([1, 2, 3]);
    const second = new Uint8Array([4, 5]);
    const request = chunkedRequest([first, second]);

    await expect(readLimitedBody(request, 5)).resolves.toEqual({
      kind: "ok",
      bytes: new Uint8Array([1, 2, 3, 4, 5]),
    });
  });

  it("cancels the stream immediately after exceeding the limit", async () => {
    const first = new Uint8Array(4);
    const second = new Uint8Array(4).fill(9);
    const remaining = new Uint8Array(100).fill(7);
    const cancel = vi.fn();
    let pullCount = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pullCount += 1;
        if (pullCount === 1) {
          controller.enqueue(first);
          return;
        }
        if (pullCount === 2) {
          controller.enqueue(second);
          return;
        }
        controller.enqueue(remaining);
      },
      cancel,
    });
    const request = new Request("https://example.org/api/payments/create", {
      method: "POST",
      body,
      // @ts-expect-error Node Request duplex is required for streaming bodies.
      duplex: "half",
    });
    const text = vi.spyOn(request, "text");

    await expect(readLimitedBody(request, 5)).resolves.toEqual({
      kind: "too-large",
    });
    expect(text).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
    expect(pullCount).toBe(2);
  });
});
