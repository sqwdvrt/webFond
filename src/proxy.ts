import { type NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  void request;
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
