import {
  evaluateReadiness,
  type ReadinessEvaluation,
} from "@/features/readiness/evaluate";
import { privateJsonResponse } from "@/lib/http/private-json-response";

type ReadinessEvaluator = () => ReadinessEvaluation;

export function checkReadiness(evaluate: ReadinessEvaluator) {
  const readiness = evaluate();

  return readiness.ok
    ? privateJsonResponse({ ok: true })
    : privateJsonResponse({ ok: false }, 503);
}

export function GET() {
  return checkReadiness(evaluateReadiness);
}
