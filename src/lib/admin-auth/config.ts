export type AdminAuthConfig = {
  username: string;
  password: string;
  secret: string;
  trustProxy: boolean;
};

type Environment = Readonly<Record<string, string | undefined>>;

export class AdminAuthConfigurationError extends Error {
  constructor(variable: string) {
    super(`Invalid ${variable}`);
    this.name = "AdminAuthConfigurationError";
  }
}

function requireValue(
  env: Environment,
  name: "ADMIN_USERNAME" | "ADMIN_PASSWORD" | "AUTH_SECRET",
) {
  const value = env[name];

  if (!value || value.trim().length === 0) {
    throw new AdminAuthConfigurationError(name);
  }

  return value;
}

export function readAdminAuthConfig(
  env: Environment = process.env,
): AdminAuthConfig {
  const username = requireValue(env, "ADMIN_USERNAME").trim();
  const password = requireValue(env, "ADMIN_PASSWORD");
  const secret = requireValue(env, "AUTH_SECRET").trim();

  if (secret.length < 32) {
    throw new AdminAuthConfigurationError("AUTH_SECRET");
  }

  if (
    env.ADMIN_TRUST_PROXY !== "true" &&
    env.ADMIN_TRUST_PROXY !== "false"
  ) {
    throw new AdminAuthConfigurationError("ADMIN_TRUST_PROXY");
  }

  return {
    username,
    password,
    secret,
    trustProxy: env.ADMIN_TRUST_PROXY === "true",
  };
}
