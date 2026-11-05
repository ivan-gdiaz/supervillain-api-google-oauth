const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { connect, disconnect } = require('./helpers');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const OAuthAttempt = require('../models/OAuthAttempt');
const User = require('../models/User');
const provider = require('../services/google');
const app = require('../app');
let expected, rejectExchange = false;
let profile = { googleSub: 'google-account-1', email: 'alice@example.test', fullname: 'Alice' };
before(async () => {
  await connect();
  mock.method(provider, 'authorizationUrl', async (attempt) => {
    expected = attempt;
    return new URL(`https://accounts.google.com/o/oauth2/v2/auth?state=${attempt.state}`);
  });
  mock.method(provider, 'exchange', async (url, attempt, state) => {
    assert.equal(url.origin + url.pathname, process.env.GOOGLE_REDIRECT_URI);
    assert.equal(state, expected.state);
    assert.equal(attempt.codeVerifier, expected.codeVerifier);
    assert.equal(attempt.nonce, expected.nonce);
    if (rejectExchange || url.searchParams.has('error')) throw new Error('invalid_grant');
    return profile;
  });
});
after(async () => { mock.restoreAll(); await disconnect(); });
async function start() {
  const agent = request.agent(app);
  const response = await agent.get('/api/auth/google').expect(302);
  const state = new URL(response.headers.location).searchParams.get('state');
  return { agent, state, response };
}
const callback = (agent, state) => agent.get('/api/auth/google/callback').query({ state, code: 'code-test' });

test('inicio genera cookie HttpOnly SameSite, datos efímeros y state distinto', async () => {
  const a = await start();
  assert.match(a.response.headers['set-cookie'][0], /HttpOnly/);
  assert.match(a.response.headers['set-cookie'][0], /SameSite=Lax/);
  assert.match(a.response.headers['cache-control'], /no-store/);
  const stored = await OAuthAttempt.findOne({ stateHash: expected.stateHash }).lean();
  assert.equal(stored.state, undefined);
  assert.notEqual(stored.browserHash, a.response.headers['set-cookie'][0].split('=')[1]);
  assert.ok(stored.expiresAt > new Date());
  const b = await start();
  assert.notEqual(a.state, b.state);
});

test('callback válido crea perfil sin contraseña y JWT de API; no devuelve tokens de Google', async () => {
  const { agent, state } = await start();
  const r = await callback(agent, state).expect(200);
  assert.equal(r.body.user.googleSub, profile.googleSub);
  assert.equal(r.body.user.password, undefined);
  assert.equal(r.body.access_token, undefined);
  assert.equal(r.body.id_token, undefined);
  assert.equal(r.headers.location, undefined);
  assert.equal(r.headers['cache-control'], 'no-store');
  assert.equal(jwt.verify(r.body.token, process.env.TOKEN_SECRET).provider, 'google');
  await request(app).get('/api/users/secure').set('Authorization', `Bearer ${r.body.token}`).expect(200);
  assert.equal(await OAuthAttempt.countDocuments({ stateHash: expected.stateHash }), 0);
});

test('volver a entrar actualiza la misma cuenta por sub, nunca vincula por email', async () => {
  profile = { ...profile, email: 'nuevo@example.test' };
  let login = await start();
  await callback(login.agent, login.state).expect(200);
  assert.equal(await User.countDocuments(), 1);
  profile = { ...profile, googleSub: 'google-account-2' };
  login = await start();
  await callback(login.agent, login.state).expect(200);
  assert.equal(await User.countDocuments(), 2);
});

test('rechaza callbacks sin cookie, state ausente, state repetido en query u otro navegador', async () => {
  const { agent, state } = await start();
  await callback(request(app), state).expect(400);
  await agent.get('/api/auth/google/callback?code=x').expect(400);
  await agent.get(`/api/auth/google/callback?state=${state}&state=${state}&code=x`).expect(400);
  await callback(agent, 'A'.repeat(43)).expect(400);
  await callback(agent, state).expect(200);
});

test('el callback solo se consume una vez incluso reenviando la cookie original', async () => {
  const { state, response } = await start();
  const cookie = response.headers['set-cookie'][0].split(';')[0];
  await callback(request(app), state).set('Cookie', cookie).expect(200);
  await callback(request(app), state).set('Cookie', cookie).expect(400);
});

test('estado caducado es rechazado aunque MongoDB no haya ejecutado el borrado TTL', async () => {
  const { agent, state } = await start();
  await OAuthAttempt.updateOne({ stateHash: expected.stateHash }, { expiresAt: new Date(0) });
  await callback(agent, state).expect(400);
});

test('denegación de consentimiento y fallo de validación no crean usuario ni token', async () => {
  const count = await User.countDocuments();
  let login = await start();
  await login.agent.get('/api/auth/google/callback').query({ state: login.state, error: 'access_denied' }).expect(401);
  login = await start();
  rejectExchange = true;
  const r = await callback(login.agent, login.state).expect(401);
  rejectExchange = false;
  assert.equal(r.body.token, undefined);
  assert.equal(JSON.stringify(r.body).includes('invalid_grant'), false);
  assert.equal(await User.countDocuments(), count);
});

test('limita los intentos de acceso OAuth', async () => {
  for (let i = 0; i < 61; i++) await request(app).get('/api/auth/google/callback');
  await request(app).get('/api/auth/google').expect(429);
});
