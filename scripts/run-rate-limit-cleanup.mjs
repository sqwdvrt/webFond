const origin = process.env.SITE_URL;
const secret = process.env.MAINTENANCE_SECRET;

try {
  if (!origin || !secret || secret.length < 32 || !/^[\x21-\x7e]+$/.test(secret)) {
    throw new Error("configuration");
  }
  const url = new URL(origin);
  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !localHttp) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("configuration");
  }
  url.pathname = "/api/maintenance/rate-limits/cleanup";
  const response = await fetch(url, {
    method: "POST",
    headers: { "x-maintenance-secret": secret },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("request");
  const result = await response.json();
  if (!Number.isInteger(result.deleted) || result.deleted < 0 || result.deleted > 1000 || typeof result.batchFull !== "boolean") {
    throw new Error("response");
  }
  console.log(JSON.stringify({ event: "rate_limit_cleanup_completed", completedAt: new Date().toISOString(), deleted: result.deleted, batchFull: result.batchFull }));
} catch {
  console.error("rate_limit_cleanup_failed");
  process.exitCode = 1;
}
