import { describe, expect, it, vi } from "vitest";

import canceledFixture from "./__fixtures__/payment-canceled.json";
import pendingFixture from "./__fixtures__/create-pending.json";
import succeededFixture from "./__fixtures__/payment-succeeded.json";
import {
  createYooKassaClient,
  YooKassaHttpError,
  YooKassaProtocolError,
  YooKassaUnavailableError,
} from "./yookassa-client";

const DONATION_ID = "f04d0001-0000-4000-8000-000000000001";
const CUSTOMER_EMAIL = "anna@example.org";
const RETURN_URL =
  "https://example.org/donation/result?donation=f04d0001-0000-4000-8000-000000000001";
const BASIC_AUTH = "Basic c2hvcC1pZDpzZWNyZXQta2V5";

const createInput = {
  amountKopecks: 30_000,
  donationId: DONATION_ID,
  returnUrl: RETURN_URL,
  customerEmail: CUSTOMER_EMAIL,
} as const;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function streamingResponse(
  status: number,
  cancel: () => void | Promise<void>,
): Response {
  return new Response(new ReadableStream({ cancel }), {
    status,
    headers:
      status >= 300 && status < 400
        ? { Location: "https://redirect.example/elsewhere" }
        : undefined,
  });
}

function copyFixture<T>(fixture: T): T {
  return JSON.parse(JSON.stringify(fixture)) as T;
}

function clientFixture() {
  const fetch = vi.fn<typeof globalThis.fetch>();
  const signal = new AbortController().signal;
  const timeoutSignal = vi.fn(() => signal);
  const client = createYooKassaClient(
    { shopId: "shop-id", secretKey: "secret-key" },
    { fetch, timeoutSignal },
  );

  return { client, fetch, signal, timeoutSignal };
}

async function rejectedValue(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
  } catch (error) {
    return error;
  }

  throw new Error("Expected operation to reject.");
}

describe("createPayment", () => {
  it("sends a redirect payment without forcing a method and parses the pending response", async () => {
    const { client, fetch, signal, timeoutSignal } = clientFixture();
    fetch.mockResolvedValue(jsonResponse(pendingFixture));

    await expect(client.createPayment(createInput)).resolves.toEqual({
      id: "provider-payment-1",
      status: "pending",
      paid: false,
      amount: { kopecks: 30_000, currency: "RUB" },
      paymentMethod: { type: "sbp" },
      confirmation: {
        type: "redirect",
        url: "https://yoomoney.ru/checkout/payments/v2/contract?orderId=provider-payment-1",
      },
      capturedAt: undefined,
      metadata: { donationId: DONATION_ID },
    });

    expect(timeoutSignal).toHaveBeenCalledOnce();
    expect(timeoutSignal).toHaveBeenCalledWith(5_000);
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.yookassa.ru/v3/payments");
    expect(init).toEqual({
      method: "POST",
      headers: {
        Authorization: BASIC_AUTH,
        "Idempotence-Key": DONATION_ID,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: expect.any(String),
      redirect: "manual",
      signal,
    });
    expect(JSON.parse(init?.body as string)).toEqual({
      amount: { value: "300.00", currency: "RUB" },
      confirmation: {
        type: "redirect",
        return_url: RETURN_URL,
      },
      capture: true,
      description: "Пожертвование Фонду «Быть Добру»",
      metadata: { donationId: DONATION_ID },
      receipt: {
        customer: { email: CUSTOMER_EMAIL },
        items: [
          {
            description: "Пожертвование Фонду «Быть Добру»",
            quantity: "1.00",
            amount: { value: "300.00", currency: "RUB" },
            vat_code: 1,
            payment_subject: "payment",
            payment_mode: "full_payment",
          },
        ],
        internet: "true",
      },
    });
  });

  it("accepts a pending checkout response before a method is chosen", async () => {
    const { client, fetch } = clientFixture();
    const body = copyFixture(pendingFixture) as Record<string, unknown>;
    delete body.payment_method;
    fetch.mockResolvedValue(jsonResponse(body));

    await expect(
      client.createPayment(createInput),
    ).resolves.toMatchObject({
      paymentMethod: undefined,
    });
  });

  it.each(["sbp", "bank_card", "yoo_money"] as const)(
    "accepts a pending create response with payment method %s",
    async (type) => {
      const { client, fetch } = clientFixture();
      fetch.mockResolvedValue(
        jsonResponse({
          ...copyFixture(pendingFixture),
          payment_method: { type },
        }),
      );

      await expect(client.createPayment(createInput)).resolves.toMatchObject({
        paymentMethod: { type },
      });
    },
  );

  it.each([
    ["succeeded", succeededFixture],
    ["canceled", canceledFixture],
  ] as const)("accepts an idempotent terminal %s response", async (_, body) => {
    const { client, fetch } = clientFixture();
    fetch.mockResolvedValue(jsonResponse(body));

    await expect(
      client.createPayment(createInput),
    ).resolves.toMatchObject({
      id: "provider-payment-1",
      status: body.status,
      amount: { kopecks: 30_000, currency: "RUB" },
      paymentMethod: { type: "sbp" },
      metadata: { donationId: DONATION_ID },
    });
  });

  it.each([
    ["amount", { amount: { value: "300.01", currency: "RUB" } }],
    ["currency", { amount: { value: "300.00", currency: "USD" } }],
    ["metadata", { metadata: { donationId: "another-donation" } }],
    ["payment method", { payment_method: { type: "sberbank" } }],
    ["confirmation type", { confirmation: { type: "embedded" } }],
    ["pending confirmation", { confirmation: undefined }],
  ])("rejects a create response with mismatched %s", async (_, replacement) => {
    const { client, fetch } = clientFixture();
    fetch.mockResolvedValue(
      jsonResponse({ ...copyFixture(pendingFixture), ...replacement }),
    );

    await expect(
      client.createPayment(createInput),
    ).rejects.toBeInstanceOf(YooKassaProtocolError);
  });

  it.each([
    [0, "0.00"],
    [1, "0.01"],
    [Number.MAX_SAFE_INTEGER, "90071992547409.91"],
  ])("formats integer kopecks %s without floating point", async (amount, value) => {
    const { client, fetch } = clientFixture();
    fetch.mockResolvedValue(
      jsonResponse({
        ...pendingFixture,
        amount: { value, currency: "RUB" },
      }),
    );

    await client.createPayment({
      ...createInput,
      amountKopecks: amount,
    });

    const [, init] = fetch.mock.calls[0]!;
    expect(JSON.parse(init?.body as string).amount.value).toBe(value);
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid integer kopecks %s before fetch",
    async (amountKopecks) => {
      const { client, fetch } = clientFixture();

      await expect(
        client.createPayment({
          ...createInput,
          amountKopecks,
        }),
      ).rejects.toBeInstanceOf(YooKassaProtocolError);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});

describe("getPayment", () => {
  it("encodes the exact provider ID and omits POST-only headers", async () => {
    const { client, fetch, signal, timeoutSignal } = clientFixture();
    const providerId = "payment/id with spaces";
    fetch.mockResolvedValue(
      jsonResponse({ ...succeededFixture, id: providerId }),
    );

    await expect(client.getPayment(providerId)).resolves.toMatchObject({
      id: providerId,
      status: "succeeded",
      paid: true,
      capturedAt: "2026-08-24T18:05:04.321Z",
    });

    expect(timeoutSignal).toHaveBeenCalledWith(5_000);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.yookassa.ru/v3/payments/payment%2Fid%20with%20spaces",
      {
        method: "GET",
        headers: {
          Authorization: BASIC_AUTH,
          Accept: "application/json",
        },
        redirect: "manual",
        signal,
      },
    );
    const headers = fetch.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers).not.toHaveProperty("Idempotence-Key");
    expect(headers).not.toHaveProperty("Content-Type");
  });

  it.each([
    ["pending", pendingFixture],
    ["succeeded", succeededFixture],
    ["canceled", canceledFixture],
    [
      "waiting_for_capture",
      { ...succeededFixture, status: "waiting_for_capture" },
    ],
    ["unknown", { ...pendingFixture, status: "refunded" }],
  ] as const)("normalizes provider status to %s", async (expected, body) => {
    const { client, fetch } = clientFixture();
    fetch.mockResolvedValue(jsonResponse(body));

    await expect(client.getPayment(body.id)).resolves.toMatchObject({
      status: expected,
    });
  });

  it("rejects a response whose ID differs from the requested ID", async () => {
    const { client, fetch } = clientFixture();
    fetch.mockResolvedValue(jsonResponse(pendingFixture));

    await expect(client.getPayment("different-id")).rejects.toBeInstanceOf(
      YooKassaProtocolError,
    );
  });

  it.each(["", " ", "\tprovider", "provider ", ".", "..", "\ud800"])(
    "rejects unsafe provider ID %j before fetch",
    async (providerId) => {
      const { client, fetch } = clientFixture();

      await expect(client.getPayment(providerId)).rejects.toBeInstanceOf(
        YooKassaProtocolError,
      );
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("keeps a valid UUID-like provider ID unchanged", async () => {
    const { client, fetch } = clientFixture();
    const providerId = "2c5b8e3f-50a8-4e9a-b6a4-c6a02b8dbbf5";
    fetch.mockResolvedValue(
      jsonResponse({ ...pendingFixture, id: providerId }),
    );

    await expect(client.getPayment(providerId)).resolves.toMatchObject({
      id: providerId,
    });
    expect(fetch.mock.calls[0]![0]).toBe(
      `https://api.yookassa.ru/v3/payments/${providerId}`,
    );
  });

  it("keeps encoded provider IDs inside the payments path", async () => {
    const { client, fetch } = clientFixture();
    const providerId = "../outside/payment?admin=true#fragment";
    fetch.mockImplementation(async (input) => {
      const request = new Request(input);

      expect(request.url).toBe(
        "https://api.yookassa.ru/v3/payments/..%2Foutside%2Fpayment%3Fadmin%3Dtrue%23fragment",
      );
      expect(new URL(request.url).pathname.startsWith("/v3/payments/")).toBe(
        true,
      );
      return jsonResponse({ ...pendingFixture, id: providerId });
    });

    await expect(client.getPayment(providerId)).resolves.toMatchObject({
      id: providerId,
    });
  });
});

describe("response validation", () => {
  it.each([
    ["object", null],
    ["id", { ...pendingFixture, id: " " }],
    ["status", { ...pendingFixture, status: 17 }],
    ["paid", { ...pendingFixture, paid: "false" }],
    ["amount", { ...pendingFixture, amount: null }],
    ["currency", { ...pendingFixture, amount: { value: "300.00" } }],
    ["payment method", { ...pendingFixture, payment_method: {} }],
    ["metadata", { ...pendingFixture, metadata: {} }],
    ["captured at", { ...pendingFixture, captured_at: 123 }],
  ])("rejects a malformed %s field", async (_, body) => {
    const { client, fetch } = clientFixture();
    fetch.mockResolvedValue(jsonResponse(body));

    await expect(
      client.getPayment(pendingFixture.id),
    ).rejects.toBeInstanceOf(YooKassaProtocolError);
  });

  it.each([
    "1",
    "1.2",
    "1.234",
    "-1.00",
    "1e2",
    " 1.00",
    "90071992547409.92",
  ])("rejects invalid or overflowing provider money %s", async (value) => {
    const { client, fetch } = clientFixture();
    fetch.mockResolvedValue(
      jsonResponse({
        ...pendingFixture,
        amount: { value, currency: "RUB" },
      }),
    );

    await expect(
      client.getPayment(pendingFixture.id),
    ).rejects.toBeInstanceOf(YooKassaProtocolError);
  });

  it("accepts the largest safe provider money value", async () => {
    const { client, fetch } = clientFixture();
    fetch.mockResolvedValue(
      jsonResponse({
        ...pendingFixture,
        amount: { value: "90071992547409.91", currency: "RUB" },
      }),
    );

    await expect(client.getPayment(pendingFixture.id)).resolves.toMatchObject({
      amount: { kopecks: Number.MAX_SAFE_INTEGER, currency: "RUB" },
    });
  });

  it.each([
    "http://example.org/confirmation",
    "https://user:password@example.org/confirmation",
    "/relative/confirmation",
    "not a URL",
  ])("rejects unsafe confirmation URL %s", async (confirmation_url) => {
    const { client, fetch } = clientFixture();
    fetch.mockResolvedValue(
      jsonResponse({
        ...pendingFixture,
        confirmation: {
          type: "redirect",
          confirmation_url,
        },
      }),
    );

    await expect(
      client.getPayment(pendingFixture.id),
    ).rejects.toBeInstanceOf(YooKassaProtocolError);
  });

  it("rejects malformed JSON as a protocol error", async () => {
    const { client, fetch } = clientFixture();
    fetch.mockResolvedValue(
      new Response("{not-json", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      client.getPayment(pendingFixture.id),
    ).rejects.toBeInstanceOf(YooKassaProtocolError);
  });

  it.each([300, 301, 302, 307, 308])(
    "manually classifies HTTP redirect %s without following Location",
    async (status) => {
      const { client, fetch } = clientFixture();
      fetch.mockResolvedValue(
        new Response(null, {
          status,
          headers: { Location: "https://redirect.example/elsewhere" },
        }),
      );

      await expect(
        client.getPayment(pendingFixture.id),
      ).rejects.toBeInstanceOf(YooKassaProtocolError);
      expect(fetch).toHaveBeenCalledOnce();
      expect(fetch.mock.calls[0]![1]?.redirect).toBe("manual");
    },
  );
});

describe("failure classification and sanitization", () => {
  it.each([400, 401, 403, 404, 429, 500, 502, 503])(
    "returns an HTTP error containing only status metadata for %s",
    async (status) => {
      const { client, fetch } = clientFixture();
      fetch.mockResolvedValue(
        new Response(
          `provider body ${DONATION_ID} shop-id secret-key ${BASIC_AUTH}`,
          { status },
        ),
      );

      const error = await rejectedValue(
        client.getPayment(pendingFixture.id),
      );
      expect(error).toBeInstanceOf(YooKassaHttpError);
      expect(error).toMatchObject({ status });
      expect(String(error)).toBe("YooKassaHttpError: YooKassa request failed.");
      expect(String(error)).not.toContain(DONATION_ID);
      expect(String(error)).not.toContain("shop-id");
      expect(String(error)).not.toContain("secret-key");
      expect(String(error)).not.toContain("provider body");
      expect(Object.keys(error as object)).toEqual(["status"]);
    },
  );

  it("logs YooKassa error code fields without the donor email", async () => {
    const { client, fetch } = clientFixture();
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetch.mockResolvedValue(
      jsonResponse(
        {
          type: "error",
          code: "invalid_request",
          description: "Receipt is missing or illegal",
          parameter: "receipt",
          email: CUSTOMER_EMAIL,
        },
        400,
      ),
    );

    await expect(client.createPayment(createInput)).rejects.toBeInstanceOf(
      YooKassaHttpError,
    );
    expect(logged).toHaveBeenCalledWith("yookassa_http_error", {
      status: 400,
      code: "invalid_request",
      description: "Receipt is missing or illegal",
      parameter: "receipt",
    });
    expect(JSON.stringify(logged.mock.calls)).not.toContain(CUSTOMER_EMAIL);
    logged.mockRestore();
  });

  it.each([
    [302, YooKassaProtocolError],
    [429, YooKassaHttpError],
  ] as const)(
    "cancels streaming body before classifying HTTP status %s",
    async (status, ErrorType) => {
      const { client, fetch } = clientFixture();
      const cancel = vi.fn();
      fetch.mockResolvedValue(streamingResponse(status, cancel));

      await expect(client.getPayment(pendingFixture.id)).rejects.toBeInstanceOf(
        ErrorType,
      );
      expect(cancel).toHaveBeenCalledOnce();
    },
  );

  it.each([
    [302, YooKassaProtocolError],
    [503, YooKassaHttpError],
  ] as const)(
    "preserves HTTP status %s error when body cancellation fails",
    async (status, ErrorType) => {
      const { client, fetch } = clientFixture();
      const cancel = vi.fn().mockRejectedValue(new Error("cancel failed"));
      fetch.mockResolvedValue(streamingResponse(status, cancel));

      await expect(client.getPayment(pendingFixture.id)).rejects.toBeInstanceOf(
        ErrorType,
      );
      expect(cancel).toHaveBeenCalledOnce();
    },
  );

  it.each([
    ["network", new TypeError(`network ${DONATION_ID} secret-key`)],
    ["timeout", new DOMException("timed out", "TimeoutError")],
    ["abort", new DOMException("aborted", "AbortError")],
  ])("classifies %s failures as sanitized unavailable errors", async (_, cause) => {
    const { client, fetch } = clientFixture();
    fetch.mockRejectedValue(cause);

    const error = await rejectedValue(
      client.getPayment(pendingFixture.id),
    );
    expect(error).toBeInstanceOf(YooKassaUnavailableError);
    expect(String(error)).toBe(
      "YooKassaUnavailableError: YooKassa is unavailable.",
    );
    expect(String(error)).not.toContain(DONATION_ID);
    expect(String(error)).not.toContain("secret-key");
  });

  it("does not expose malformed provider content in protocol errors", async () => {
    const { client, fetch } = clientFixture();
    fetch.mockResolvedValue(
      jsonResponse({
        providerBody: `${DONATION_ID} shop-id secret-key ${BASIC_AUTH}`,
      }),
    );

    const error = await rejectedValue(
      client.getPayment(pendingFixture.id),
    );
    expect(error).toBeInstanceOf(YooKassaProtocolError);
    expect(String(error)).toBe(
      "YooKassaProtocolError: YooKassa returned an invalid response.",
    );
    expect(String(error)).not.toContain(DONATION_ID);
    expect(String(error)).not.toContain("shop-id");
    expect(String(error)).not.toContain("secret-key");
  });
});
