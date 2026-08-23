import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AdminAuthConfigurationError,
  type AdminAuthConfig,
  readAdminAuthConfig,
} from "./config";
import {
  type AdminSessionPayload,
  createSessionToken,
  verifySessionToken,
} from "./session-token";

export const ADMIN_SESSION_COOKIE = "byt_dobru_admin_session";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

type CookieWriter = {
  set(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      sameSite: "lax";
      path: string;
      secure: boolean;
      maxAge: number;
      expires: Date;
    },
  ): void;
};

type CookieDeleter = {
  delete(name: string): void;
};

function nowInSeconds() {
  return Math.floor(Date.now() / 1_000);
}

export function readAdminSessionFromStore(input: {
  store: CookieReader;
  config: AdminAuthConfig;
  now: number;
}) {
  const token = input.store.get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken({
    token,
    username: input.config.username,
    secret: input.config.secret,
    now: input.now,
  });
}

export function writeAdminSessionToStore(input: {
  store: CookieWriter;
  config: AdminAuthConfig;
  now: number;
  environment: string | undefined;
}): AdminSessionPayload {
  const { token, payload } = createSessionToken({
    username: input.config.username,
    secret: input.config.secret,
    now: input.now,
  });

  input.store.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: input.environment === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    expires: new Date(payload.expiresAt * 1_000),
  });

  return payload;
}

export function clearAdminSessionFromStore(store: CookieDeleter) {
  store.delete(ADMIN_SESSION_COOKIE);
}

export async function getAdminSession() {
  try {
    const config = readAdminAuthConfig();
    const cookieStore = await cookies();
    return readAdminSessionFromStore({
      store: cookieStore,
      config,
      now: nowInSeconds(),
    });
  } catch (error) {
    if (error instanceof AdminAuthConfigurationError) {
      return null;
    }

    throw error;
  }
}

export async function setAdminSession(username: string) {
  const config = readAdminAuthConfig();

  if (username !== config.username) {
    throw new AdminAuthConfigurationError("ADMIN_USERNAME");
  }

  const cookieStore = await cookies();
  writeAdminSessionToStore({
    store: cookieStore,
    config,
    now: nowInSeconds(),
    environment: process.env.NODE_ENV,
  });
}

export async function clearAdminSession() {
  clearAdminSessionFromStore(await cookies());
}

export async function requireAdminSession() {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  return session;
}
