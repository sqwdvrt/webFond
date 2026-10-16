import {
  AdminAuthConfigurationError,
  readAdminAuthConfig,
} from "@/lib/admin-auth/config";

export type ReadinessIssueCode = "ADMIN_AUTH";

export type ReadinessEvaluation =
  | { ok: true; issues: [] }
  | { ok: false; issues: ReadinessIssueCode[] };

export function evaluateReadiness(
  readConfig: typeof readAdminAuthConfig = readAdminAuthConfig,
): ReadinessEvaluation {
  try {
    readConfig();
    return { ok: true, issues: [] };
  } catch (error) {
    if (error instanceof AdminAuthConfigurationError) {
      return { ok: false, issues: ["ADMIN_AUTH"] };
    }

    throw error;
  }
}
