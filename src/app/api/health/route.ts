import { privateJsonResponse } from "@/lib/http/private-json-response";

export function GET() {
  return privateJsonResponse({ ok: true });
}
