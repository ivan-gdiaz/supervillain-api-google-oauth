const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./helpers');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const oidc = require('openid-client');
const { createProvider } = require('../services/google');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const wrongKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
const google = require('../config/google');
const attempt = { nonce: 'test-nonce', codeVerifier: 'a'.repeat(43) };
const state = 'state-test';
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
function fixture(overrides = {}, signingKey = privateKey) {
  const config = new oidc.Configuration({
    issuer: 'https://accounts.google.com', authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_endpoint: 'https://oauth2.googleapis.com/token', jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs'
  }, google.clientId, { client_secret: google.clientSecret, id_token_signed_response_alg: 'RS256' });
  config[oidc.customFetch] = async (url, options) => {
    if (String(url).endsWith('/certs')) return Response.json({ keys: [jwk] });
    assert.equal(String(url), 'https://oauth2.googleapis.com/token');
    const body = new URLSearchParams(options.body);
    assert.equal(body.get('code_verifier'), attempt.codeVerifier);
    assert.equal(body.get('redirect_uri'), google.redirectUri);
    assert.equal(body.get('grant_type'), 'authorization_code');
    const claims = { iss: 'https://accounts.google.com', aud: google.clientId, sub: 'google-user',
      email: 'alumno@example.test', email_verified: true, name: 'Alumno', nonce: attempt.nonce,
      iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...overrides };
    const idToken = jwt.sign(claims, signingKey, { algorithm: 'RS256', keyid: 'test-key' });
    return Response.json({ access_token: 'google-access-token', token_type: 'Bearer', expires_in: 3600, id_token: idToken });
  };
  oidc.enableNonRepudiationChecks(config);
  return createProvider(async () => config);
}
function callback(givenState = state) {
  const url = new URL(google.redirectUri);
  url.search = new URLSearchParams({ code: 'test-code', state: givenState });
  return url;
}
test('solicita código, scopes mínimos, nonce y PKCE S256; nunca acceso offline', async () => {
  const url = await fixture().authorizationUrl({ ...attempt, state });
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('scope'), 'openid email profile');
  assert.equal(url.searchParams.get('nonce'), attempt.nonce);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('code_challenge'), await oidc.calculatePKCECodeChallenge(attempt.codeVerifier));
  assert.equal(url.searchParams.get('access_type'), null);
});
test('protocolo real: valida ID token firmado con JWKS y devuelve solo el perfil', async () => {
  assert.deepEqual(await fixture().exchange(callback(), attempt, state), {
    googleSub: 'google-user', email: 'alumno@example.test', fullname: 'Alumno'
  });
});
test('protocolo real: rechaza firma falsa, issuer, audience, nonce y expiración incorrectos', async () => {
  for (const claims of [{ iss: 'https://atacante.example' }, { aud: 'otro-cliente' },
    { nonce: 'otra-sesion' }, { exp: 1 }, { email_verified: false }, { email: '' }]) {
    await assert.rejects(() => fixture(claims).exchange(callback(), attempt, state));
  }
  await assert.rejects(() => fixture({}, wrongKey).exchange(callback(), attempt, state));
  await assert.rejects(() => fixture().exchange(callback('otro-state'), attempt, state));
});
