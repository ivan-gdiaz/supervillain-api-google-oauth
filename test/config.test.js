const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const configPath = path.resolve(__dirname, '../config/google.js');
function load(extra = {}) {
  return spawnSync(process.execPath, ['-e', `console.log(require(${JSON.stringify(configPath)}).secureCookie)`], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, NODE_ENV: 'production', GOOGLE_CLIENT_ID: 'test.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'fake-secret', GOOGLE_REDIRECT_URI: 'https://api.example.test/api/auth/google/callback', ...extra }
  });
}
test('producción exige credenciales y callback HTTPS fijo', () => {
  assert.equal(load().status, 0);
  assert.equal(load().stdout.trim(), 'true');
  for (const extra of [
    { GOOGLE_CLIENT_ID: '' }, { GOOGLE_CLIENT_SECRET: '' }, { GOOGLE_REDIRECT_URI: '' },
    { GOOGLE_REDIRECT_URI: 'http://api.example.test/api/auth/google/callback' },
    { GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/auth/google/callback' },
    { GOOGLE_REDIRECT_URI: 'https://api.example.test/otra-ruta' },
    { GOOGLE_REDIRECT_URI: 'https://api.example.test/api/auth/google/callback?next=otro' }
  ]) assert.notEqual(load(extra).status, 0);
});
test('desarrollo permite HTTP únicamente en loopback y sin cookie Secure', () => {
  const r = load({ NODE_ENV: 'development', GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/auth/google/callback' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), 'false');
});
