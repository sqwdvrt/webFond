import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClientKey } from "@/lib/admin-auth/client-key";
import {
  AdminAuthConfigurationError,
  type AdminAuthConfig,
  readAdminAuthConfig,
} from "@/lib/admin-auth/config";
import { credentialsMatch } from "@/lib/admin-auth/credentials";
import { LoginAttemptLimiter } from "@/lib/admin-auth/rate-limit";
import { setAdminSession } from "@/lib/admin-auth/session";

export type LoginActionState = {
  status: "idle" | "error";
  message: string;
};

type LoginResult = LoginActionState | { status: "success" };

type LoginDependencies = {
  readConfig: () => AdminAuthConfig;
  readHeaders: () => Promise<{ get(name: string): string | null }>;
  limiter: LoginAttemptLimiter;
  setSession: (username: string) => Promise<void>;
  now: () => number;
  environment: string | undefined;
};

const loginLimiter = new LoginAttemptLimiter();

function error(message: string): LoginActionState {
  return { status: "error", message };
}

export async function performLogin(
  formData: FormData,
  dependencies: LoginDependencies,
): Promise<LoginResult> {
  const usernameValue = formData.get("username");
  const passwordValue = formData.get("password");
  const username =
    typeof usernameValue === "string" ? usernameValue.trim() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (!username || !password.trim()) {
    return error("Введите логин и пароль");
  }

  let config: AdminAuthConfig;

  try {
    config = dependencies.readConfig();
  } catch (configurationError) {
    if (configurationError instanceof AdminAuthConfigurationError) {
      return error("Вход временно недоступен. Попробуйте позже");
    }

    throw configurationError;
  }

  const clientKey = createClientKey({
    headers: await dependencies.readHeaders(),
    secret: config.secret,
    trustProxy: config.trustProxy,
    environment: dependencies.environment,
  });
  const now = dependencies.now();

  if (!dependencies.limiter.check(clientKey, now).allowed) {
    return error("Вход временно недоступен. Попробуйте позже");
  }

  if (!credentialsMatch({ username, password, config })) {
    dependencies.limiter.recordFailure(clientKey, now);
    return error("Неверный логин или пароль");
  }

  await dependencies.setSession(config.username);
  dependencies.limiter.recordSuccess(clientKey);
  return { status: "success" };
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  "use server";

  const result = await performLogin(formData, {
    readConfig: readAdminAuthConfig,
    readHeaders: headers,
    limiter: loginLimiter,
    setSession: setAdminSession,
    now: Date.now,
    environment: process.env.NODE_ENV,
  });

  if (result.status === "success") {
    redirect("/admin");
  }

  return result;
}
