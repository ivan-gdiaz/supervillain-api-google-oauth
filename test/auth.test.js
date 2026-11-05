const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { connect, disconnect, authenticate } = require('./helpers');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const auth = require('../config/auth');
const User = require('../models/User');
const app = require('../app');
let token;
before(async () => { await connect(); token = await authenticate(app); });
after(disconnect);

test('ya no existe registro ni signin con contraseña', async () => {
  await request(app).post('/api/users').send({ username: 'alumno', password: '12345678' }).expect(404);
  await request(app).post('/api/users/signin').send({ username: 'alumno', password: '12345678' }).expect(404);
  const user = await User.findOne().lean();
  assert.equal(user.password, undefined);
  assert.equal(user.username, undefined);
  assert.equal(User.collection.name, 'oauth_users');
});

test('JWT dura una hora y da acceso al perfil de Google', async () => {
  const claims = jwt.verify(token, process.env.TOKEN_SECRET, { algorithms: ['HS256'] });
  assert.equal(claims.exp - claims.iat, 3600);
  assert.equal(claims.provider, 'google');
  assert.equal(claims.iss, auth.issuer);
  assert.equal(claims.aud, auth.audience);
  assert.equal(claims.password, undefined);
  const r = await request(app).get('/api/users/secure').set('Authorization', `Bearer ${token}`).expect(200);
  assert.equal(r.body.data._id, claims.sub);
  assert.equal(r.body.data.password, undefined);
});

test('rechaza ausencia de cabecera, esquema incorrecto y tokens manipulados o caducados', async () => {
  const payload = { provider: 'google', sub: '64b7f0f2f2f2f2f2f2f2f2f2', iss: auth.issuer, aud: auth.audience };
  const expired = jwt.sign(payload, process.env.TOKEN_SECRET, { expiresIn: -1 });
  const wrongKey = jwt.sign(payload, 'otra-clave', { expiresIn: 3600 });
  const wrongAlgorithm = jwt.sign(payload, process.env.TOKEN_SECRET, { algorithm: 'HS384', expiresIn: 3600 });
  const unsigned = jwt.sign(payload, null, { algorithm: 'none', expiresIn: 3600 });
  const noExpiry = jwt.sign(payload, process.env.TOKEN_SECRET);
  const parts = token.split('.');
  parts[1] = Buffer.from(JSON.stringify({ ...jwt.decode(token), sub: '64b7f0f2f2f2f2f2f2f2f2f3' })).toString('base64url');
  for (const header of ['', 'Bearer', `Basic ${token}`, 'Bearer basura', `Bearer ${token} extra`,
    `Bearer ${expired}`, `Bearer ${wrongKey}`, `Bearer ${wrongAlgorithm}`, `Bearer ${unsigned}`,
    `Bearer ${noExpiry}`, `Bearer ${parts.join('.')}`]) {
    const r = request(app).get('/api/users/secure');
    if (header) r.set('Authorization', header);
    await r.expect(401).expect('WWW-Authenticate', 'Bearer');
  }
});

test('todas las operaciones de negocio salvo GET del listado exigen JWT antes de consultar MongoDB', async () => {
  const bases = ['/api/villains', '/api/villains/no-id/lairs',
    '/api/villains/no-id/lairs/no-id/minions', '/api/villains/no-id/lairs/no-id/devices'];
  for (const base of bases) {
    for (const [method, path] of [['get', base], ['post', base], ['get', `${base}/no-id`],
      ['put', `${base}/no-id`], ['delete', `${base}/no-id`]]) {
      if (method === 'get' && path === '/api/villains') continue;
      await request(app)[method](path).expect(401);
    }
  }
});

test('health es público y el listado funciona con token antes y después del ejercicio', async () => {
  await request(app).get('/health').expect(200);
  await request(app).get('/api/villains').set('Authorization', `Bearer ${token}`).expect(200);
});

test('JSON mal formado y errores no filtran los datos enviados', async () => {
  const r = await request(app).post('/api/users').set('Content-Type', 'application/json').send('{"password":"dato-secreto",').expect(400);
  assert.equal(JSON.stringify(r.body).includes('dato-secreto'), false);
});

test('rechaza JWT de la versión antigua y de otra audiencia', async () => {
  const legacy = jwt.sign({ username: 'alumno', sub: jwt.decode(token).sub }, process.env.TOKEN_SECRET, { expiresIn: 3600 });
  const other = jwt.sign({ provider: 'google', sub: jwt.decode(token).sub }, process.env.TOKEN_SECRET,
    { issuer: auth.issuer, audience: 'otra-api', expiresIn: 3600 });
  for (const value of [legacy, other]) {
    await request(app).get('/api/users/secure').set('Authorization', `Bearer ${value}`).expect(401);
  }
});
