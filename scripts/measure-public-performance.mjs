import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const origin = new URL(process.env.PERF_BASE_URL ?? 'http://127.0.0.1:3317');
if (!['localhost', '127.0.0.1'].includes(origin.hostname) || origin.protocol !== 'http:') {
  throw new Error('Performance measurements require a local HTTP server');
}
const allowedRoutes = ['/', '/news', '/projects', '/reports', '/sitemap.xml'];
const routes = process.env.PERF_ROUTES ? process.env.PERF_ROUTES.split(',') : allowedRoutes;
if (!routes.length || routes.some(route => !allowedRoutes.includes(route))) throw new Error('Use only the documented public measurement routes');
const concurrency = Number(process.env.PERF_CONCURRENCY ?? '1');
const requests = Number(process.env.PERF_REQUESTS ?? '100');
if (![1,5].includes(concurrency) || !Number.isInteger(requests) || requests < 100 || requests > 1000) {
  throw new Error('Use concurrency 1 or 5 and 100..1000 requests per route');
}
const percentile = (values, fraction) => [...values].sort((a,b) => a-b)[Math.ceil(values.length * fraction) - 1];
const serverPid = process.env.PERF_SERVER_PID;
if (serverPid && !/^\d+$/.test(serverPid)) throw new Error('Invalid PERF_SERVER_PID');
const rss = () => serverPid ? Number(execFileSync('ps', ['-o','rss=', '-p',serverPid], { encoding:'utf8' }).trim()) : null;

for (const route of routes) {
  const url = new URL(route, origin);
  const run = async () => {
    const started = performance.now();
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect:'error' });
    const ttfb = performance.now() - started;
    const bytes = (await response.arrayBuffer()).byteLength;
    return { ttfb, bytes, ok: response.ok };
  };
  for (let warmup=0; warmup<10; warmup++) await run();
  for (let repeat=1; repeat<=3; repeat++) {
    let next=0;
    const results=[];
    await Promise.all(Array.from({length:concurrency}, async () => {
      while (next < requests) { next++; results.push(await run()); }
    }));
    const timings=results.map(item=>item.ttfb);
    console.log(JSON.stringify({route, concurrency, repeat, requests,
      p50Ms: Number(percentile(timings,.5).toFixed(2)), p95Ms: Number(percentile(timings,.95).toFixed(2)),
      errors: results.filter(item=>!item.ok).length, responseBytes: Math.round(results.reduce((sum,item)=>sum+item.bytes,0)/requests),
      rssKiB:rss(),
    }));
  }
}
