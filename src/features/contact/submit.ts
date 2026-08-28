import { prisma } from "@/lib/db";
import { createPaymentClientKey } from "@/features/payments/client-key";
import {
  PaymentRateLimitedError,
  consumeBucket,
} from "@/features/payments/rate-limit";

import { parseContactForm, type ContactFormValues } from "./validation";

export type ContactFormState = {
  status: "idle" | "error" | "success";
  message: string;
  errors?: Partial<ContactFormValues>;
  values?: ContactFormValues;
};

type HeaderReader = Pick<Headers, "get">;

export type SubmitContactDependencies = {
  headers: HeaderReader;
  now: Date;
  environment: string | undefined;
  secret: string;
  trustProxy: boolean;
  save: (input: ContactFormValues, clientKey: string, now: Date) => Promise<
    "ok" | "rate-limited"
  >;
};

const CLIENT_WINDOW_MS = 10 * 60 * 1_000;
const GLOBAL_WINDOW_MS = 60 * 1_000;
const CLIENT_LIMIT = 5;
const GLOBAL_LIMIT = 20;

const SUCCESS_MESSAGE =
  "Сообщение получили. Ответим на указанную почту.";
const INVALID_MESSAGE = "Проверьте заполнение формы";
const RATE_LIMIT_MESSAGE =
  "Слишком много писем подряд. Подождите немного и попробуйте снова.";
const FAILURE_MESSAGE =
  "Сейчас не получилось отправить. Напишите на почту или попробуйте позже.";

const idleState: ContactFormState = { status: "idle", message: "" };

function readGuardConfig() {
  const secret = process.env.AUTH_SECRET?.trim();

  return {
    secret:
      secret && secret.length >= 32
        ? secret
        : "contact-rate-limit-dev-secret-key-32",
    trustProxy:
      process.env.VERCEL === "1" || process.env.ADMIN_TRUST_PROXY === "true",
  };
}

export async function defaultSaveContact(
  input: ContactFormValues,
  clientKey: string,
  now: Date,
): Promise<"ok" | "rate-limited"> {
  try {
    await prisma.$transaction(async (tx) => {
      await consumeBucket(tx, {
        key: `contact:client:10m:${clientKey}`,
        now,
        windowMs: CLIENT_WINDOW_MS,
        limit: CLIENT_LIMIT,
      });
      await consumeBucket(tx, {
        key: "contact:global:1m",
        now,
        windowMs: GLOBAL_WINDOW_MS,
        limit: GLOBAL_LIMIT,
      });
      await tx.contactRequest.create({
        data: {
          name: input.name,
          email: input.email,
          message: input.message,
        },
      });
    });

    return "ok";
  } catch (error) {
    if (error instanceof PaymentRateLimitedError) {
      return "rate-limited";
    }

    throw error;
  }
}

export async function submitContact(
  _state: ContactFormState,
  formData: FormData,
  dependencies: SubmitContactDependencies,
): Promise<ContactFormState> {
  void _state;
  const parsed = parseContactForm(formData);

  if (parsed.kind === "bot") {
    return { status: "success", message: SUCCESS_MESSAGE };
  }

  if (parsed.kind === "invalid") {
    return {
      status: "error",
      message: INVALID_MESSAGE,
      errors: parsed.errors,
      values: parsed.values,
    };
  }

  const clientKey = createPaymentClientKey({
    headers: dependencies.headers,
    secret: dependencies.secret,
    trustProxy: dependencies.trustProxy,
    environment: dependencies.environment,
  });

  try {
    const saved = await dependencies.save(
      parsed.value,
      clientKey,
      dependencies.now,
    );

    if (saved === "rate-limited") {
      return {
        status: "error",
        message: RATE_LIMIT_MESSAGE,
        values: parsed.value,
      };
    }

    return { status: "success", message: SUCCESS_MESSAGE };
  } catch {
    return {
      status: "error",
      message: FAILURE_MESSAGE,
      values: parsed.value,
    };
  }
}

export function createDefaultSubmitDependencies(
  headers: HeaderReader,
  now = new Date(),
): SubmitContactDependencies {
  const guard = readGuardConfig();

  return {
    headers,
    now,
    environment: process.env.NODE_ENV,
    secret: guard.secret,
    trustProxy: guard.trustProxy,
    save: defaultSaveContact,
  };
}

export { idleState };
