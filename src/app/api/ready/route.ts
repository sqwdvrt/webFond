import {
  AdminAuthConfigurationError,
  readAdminAuthConfig,
} from "@/lib/admin-auth/config";
import { privateJsonResponse } from "@/lib/http/private-json-response";

export function checkReadiness(readConfig: typeof readAdminAuthConfig) {
  try {
    readConfig();
    return privateJsonResponse({ ok: true });
  } catch (error) {
    if (error instanceof AdminAuthConfigurationError) {
      return privateJsonResponse({ ok: false }, 503);
    }

    throw error;
  }
}

export function GET() {
  return checkReadiness(readAdminAuthConfig);
}
