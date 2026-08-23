import { createHmac, timingSafeEqual } from "node:crypto";

import type { AdminAuthConfig } from "./config";

function digest(value: string, secret: string) {
  return createHmac("sha256", secret).update(value, "utf8").digest();
}

export function credentialsMatch(input: {
  username: string;
  password: string;
  config: AdminAuthConfig;
}) {
  const usernameMatches = timingSafeEqual(
    digest(input.username, input.config.secret),
    digest(input.config.username, input.config.secret),
  );
  const passwordMatches = timingSafeEqual(
    digest(input.password, input.config.secret),
    digest(input.config.password, input.config.secret),
  );

  return usernameMatches && passwordMatches;
}
