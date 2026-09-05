const PRIVACY_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export function GET() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      ...PRIVACY_HEADERS,
      "Content-Type": "application/json",
    },
  });
}
