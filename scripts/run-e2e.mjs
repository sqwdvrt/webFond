import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// Validate before importing app code, starting a server, migrating, or building.
const raw = process.env.E2E_DATABASE_URL;
let database;
try { database = new URL(raw ?? ''); } catch { throw new Error('E2E_DATABASE_URL must be an explicit local PostgreSQL *_test database'); }
if (!['postgres:', 'postgresql:'].includes(database.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) ||
    !/^[a-zA-Z0-9_]+_test$/.test(decodeURIComponent(database.pathname.slice(1))) ||
    database.search || database.hash) {
  throw new Error('Unsafe E2E_DATABASE_URL: require local PostgreSQL, simple *_test name, no query/hash');
}
for (const name of ['E2E_BASE_URL', 'NEXT_PUBLIC_SITE_URL', 'SITE_URL']) {
  if (process.env[name] && !['http://127.0.0.1:3017', 'http://localhost:3017'].includes(process.env[name])) {
    throw new Error(`Unsafe ${name}: browser smoke uses only localhost:3017`);
  }
}
// Next automatically loads dotenv files even with a sanitized child environment.
for (const file of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  if (existsSync(file)) throw new Error(`Remove ${file} from this isolated checkout before browser smoke (Next loads it automatically)`);
}
const mode = process.argv[2];
if (mode === 'check') process.exit(0);
const enabled = mode === 'start-payments';
const port = enabled ? '3018' : '3017';
const origin = `http://127.0.0.1:${port}`;
const env = {
  PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '',
  ...(process.env.CI ? { CI: 'true' } : {}),
  NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
  DATABASE_URL: database.href, DATABASE_URL_UNPOOLED: database.href,
  NEXT_PUBLIC_SITE_URL: origin, SITE_URL: origin,
  AUTH_SECRET: 'browser-smoke-only-auth-secret-000000000000000',
  ADMIN_USERNAME: 'browser-smoke-admin', ADMIN_PASSWORD: 'browser-smoke-dummy-password',
  MAINTENANCE_SECRET: 'browser-smoke-only-maintenance-secret-000000',
  ADMIN_TRUST_PROXY: 'false', PAYMENTS_TRUST_PROXY: 'false',
  PAYMENTS_ENABLED: enabled ? 'true' : 'false',
  PAYMENTS_OFFER_VERSION: '2026-09-04',
  PAYMENTS_RATE_LIMIT_SECRET: 'browser-smoke-only-payment-secret-000000000',
  PAYMENTS_RECONCILE_SECRET: 'browser-smoke-only-maintenance-secret-000000',
  YOOKASSA_SHOP_ID: 'browser-smoke-dummy-shop', YOOKASSA_SECRET_KEY: 'browser-smoke-dummy-secret',
  YOOKASSA_RETURN_URL: `${origin}/donation/result`,
};
const commands = {
  migrate: ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
  build: ['node_modules/next/dist/bin/next', 'build'],
  start: ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port],
  'start-payments': ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port],
};
if (!Object.hasOwn(commands, mode)) throw new Error('Expected check, migrate, build, start or start-payments');
const result = spawnSync(process.execPath, commands[mode], { env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
