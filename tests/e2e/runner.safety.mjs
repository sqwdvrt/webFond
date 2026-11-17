import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const runner = resolve('scripts/run-e2e.mjs');
const safe = 'postgresql://postgres:postgres@127.0.0.1:5432/foundation_browser_test';
function check(overrides, cwd = process.cwd(), command = 'check') {
  return spawnSync(process.execPath, [runner, command], {
    cwd, encoding: 'utf8', env: { PATH: process.env.PATH, E2E_DATABASE_URL: safe, ...overrides },
  });
}
for (const value of [undefined, 'postgresql://prod.example/foundation_test', 'postgresql://localhost/foundation', 'postgresql://localhost/foundation_test?host=prod.example', 'postgresql://localhost/a%2fb_test', 'file:///tmp/example_test']) {
  test(`reject unsafe database ${value}`, () => {
    const result = check({ E2E_DATABASE_URL: value }, process.cwd(), 'build');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /E2E_DATABASE_URL/);
  });
}
test('accept explicit loopback test database', () => assert.equal(check({}).status, 0));
for (const key of ['E2E_BASE_URL', 'NEXT_PUBLIC_SITE_URL', 'SITE_URL']) {
  test(`reject public ${key} before build`, () => {
    const result = check({ [key]: 'https://production.example' }, process.cwd(), 'build');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(`Unsafe ${key}`));
  });
}
test('reject Next dotenv inheritance before startup', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'browser-smoke-safety-'));
  try {
    writeFileSync(join(cwd, '.env.production'), 'DATABASE_URL=production');
    const result = check({}, cwd, 'start');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Remove .env.production/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
