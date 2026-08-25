import type { YooKassaConfig } from "./types";

const PAYMENTS_ENDPOINT = "https://api.yookassa.ru/v3/payments";
const REQUEST_TIMEOUT_MS = 5_000;
const DESCRIPTION = "Пожертвование Фонду «Быть Добру»";
const MONEY_PATTERN = /^[0-9]+\.[0-9]{2}$/;
const MAX_SAFE_KOPECKS = BigInt(Number.MAX_SAFE_INTEGER);

type Fetch = typeof globalThis.fetch;
type YooKassaPaymentStatus =
  | "pending"
  | "succeeded"
  | "canceled"
  | "waiting_for_capture"
  | "unknown";

export type YooKassaPayment = {
  id: string;
  status: YooKassaPaymentStatus;
  paid: boolean;
  amount: {
    kopecks: number;
    currency: string;
  };
  paymentMethod: {
    type: string;
  };
  confirmation:
    | {
        type: string;
        url: string;
      }
    | undefined;
  capturedAt: string | undefined;
  metadata: {
    donationId: string;
  };
};

export type YooKassaCreatePaymentInput = {
  amountKopecks: number;
  donationId: string;
  returnUrl: string;
};

export type YooKassaClient = {
  createPayment(input: YooKassaCreatePaymentInput): Promise<YooKassaPayment>;
  getPayment(id: string): Promise<YooKassaPayment>;
};

type YooKassaClientDependencies = {
  fetch?: Fetch;
  timeoutSignal?: (milliseconds: number) => AbortSignal;
};

export class YooKassaHttpError extends Error {
  constructor(public readonly status: number) {
    super("YooKassa request failed.");
    Object.defineProperty(this, "name", { value: "YooKassaHttpError" });
  }
}

export class YooKassaUnavailableError extends Error {
  constructor() {
    super("YooKassa is unavailable.");
    Object.defineProperty(this, "name", {
      value: "YooKassaUnavailableError",
    });
  }
}

export class YooKassaProtocolError extends Error {
  constructor() {
    super("YooKassa returned an invalid response.");
    Object.defineProperty(this, "name", { value: "YooKassaProtocolError" });
  }
}

function protocolError(): YooKassaProtocolError {
  return new YooKassaProtocolError();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonblankString(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw protocolError();
  }

  return value;
}

function parseMoney(value: unknown): number {
  if (typeof value !== "string" || !MONEY_PATTERN.test(value)) {
    throw protocolError();
  }

  const [roubles, kopecks] = value.split(".");
  const total = BigInt(roubles!) * BigInt(100) + BigInt(kopecks!);

  if (total > MAX_SAFE_KOPECKS) {
    throw protocolError();
  }

  return Number(total);
}

function parseStatus(value: unknown): YooKassaPaymentStatus {
  const status = readNonblankString(value);

  switch (status) {
    case "pending":
    case "succeeded":
    case "canceled":
    case "waiting_for_capture":
      return status;
    default:
      return "unknown";
  }
}

function parseConfirmation(
  value: unknown,
): YooKassaPayment["confirmation"] {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw protocolError();
  }

  const type = readNonblankString(value.type);
  const confirmationUrl = readNonblankString(value.confirmation_url);
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(confirmationUrl);
  } catch {
    throw protocolError();
  }

  if (
    parsedUrl.protocol !== "https:" ||
    !parsedUrl.hostname ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw protocolError();
  }

  return { type, url: confirmationUrl };
}

function parsePayment(value: unknown): YooKassaPayment {
  if (!isRecord(value)) {
    throw protocolError();
  }

  if (!isRecord(value.amount)) {
    throw protocolError();
  }

  if (!isRecord(value.payment_method)) {
    throw protocolError();
  }

  if (!isRecord(value.metadata)) {
    throw protocolError();
  }

  if (typeof value.paid !== "boolean") {
    throw protocolError();
  }

  const capturedAt =
    value.captured_at === undefined
      ? undefined
      : readNonblankString(value.captured_at);

  return {
    id: readNonblankString(value.id),
    status: parseStatus(value.status),
    paid: value.paid,
    amount: {
      kopecks: parseMoney(value.amount.value),
      currency: readNonblankString(value.amount.currency),
    },
    paymentMethod: {
      type: readNonblankString(value.payment_method.type),
    },
    confirmation: parseConfirmation(value.confirmation),
    capturedAt,
    metadata: {
      donationId: readNonblankString(value.metadata.donationId),
    },
  };
}

function formatMoney(amountKopecks: number): string {
  if (
    !Number.isSafeInteger(amountKopecks) ||
    amountKopecks < 0
  ) {
    throw protocolError();
  }

  const roubles = Math.floor(amountKopecks / 100);
  const kopecks = String(amountKopecks % 100).padStart(2, "0");
  return `${roubles}.${kopecks}`;
}

function defaultTimeoutSignal(milliseconds: number): AbortSignal {
  return AbortSignal.timeout(milliseconds);
}

function encodeProviderId(id: string): string {
  if (id === "" || id.trim() !== id || id === "." || id === "..") {
    throw protocolError();
  }

  try {
    return encodeURIComponent(id);
  } catch {
    throw protocolError();
  }
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Preserve the redirect or HTTP error as the primary failure.
  }
}

export function createYooKassaClient(
  config: YooKassaConfig,
  dependencies: YooKassaClientDependencies = {},
): YooKassaClient {
  const fetch = dependencies.fetch ?? globalThis.fetch;
  const timeoutSignal = dependencies.timeoutSignal ?? defaultTimeoutSignal;
  const authorization = `Basic ${Buffer.from(
    `${config.shopId}:${config.secretKey}`,
    "utf8",
  ).toString("base64")}`;

  async function request(url: string, init: RequestInit): Promise<unknown> {
    let response: Response;

    try {
      response = await fetch(url, {
        ...init,
        redirect: "manual",
        signal: timeoutSignal(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new YooKassaUnavailableError();
    }

    if (response.status >= 300 && response.status < 400) {
      await cancelResponseBody(response);
      throw protocolError();
    }

    if (!response.ok) {
      await cancelResponseBody(response);
      throw new YooKassaHttpError(response.status);
    }

    try {
      return await response.json();
    } catch {
      throw protocolError();
    }
  }

  return {
    async createPayment(input) {
      const amountValue = formatMoney(input.amountKopecks);
      const response = await request(PAYMENTS_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Idempotence-Key": input.donationId,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          amount: { value: amountValue, currency: "RUB" },
          payment_method_data: { type: "sbp" },
          confirmation: {
            type: "redirect",
            return_url: input.returnUrl,
          },
          capture: true,
          description: DESCRIPTION,
          metadata: { donationId: input.donationId },
        }),
      });
      const payment = parsePayment(response);

      if (
        payment.amount.kopecks !== input.amountKopecks ||
        payment.amount.currency !== "RUB" ||
        payment.paymentMethod.type !== "sbp" ||
        payment.metadata.donationId !== input.donationId ||
        (payment.confirmation !== undefined &&
          payment.confirmation.type !== "redirect") ||
        (payment.status === "pending" && payment.confirmation === undefined)
      ) {
        throw protocolError();
      }

      return payment;
    },

    async getPayment(id) {
      const encodedId = encodeProviderId(id);
      const response = await request(
        `${PAYMENTS_ENDPOINT}/${encodedId}`,
        {
          method: "GET",
          headers: {
            Authorization: authorization,
            Accept: "application/json",
          },
        },
      );
      const payment = parsePayment(response);

      if (payment.id !== id) {
        throw protocolError();
      }

      return payment;
    },
  };
}
