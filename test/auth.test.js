const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { connect, disconnect, authenticate } = require('./helpers');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const app = require('../app');
let token;
before(async () => { await connect(); token = await authenticate(app); });
after(disconnect);

test('registro almacena hash y nunca devuelve contraseña; normaliza username', async () => {
  const response = await request(app).post('/api/users').send({
    username: 'OTRO', password: 'Password_123', email: 'otro@example.test', admin: true
  }).expect(201);
  assert.equal(response.body.data.username, 'otro');
  assert.equal(response.body.data.password, undefined);
  assert.equal(response.body.data.admin, undefined);
  const user = await User.findOne({ username: 'otro' }).select('+password');
  assert.notEqual(user.password, 'Password_123');
  assert.equal(await bcrypt.compare('Password_123', user.password), true);
  const hash = user.password;
  user.fullname = 'Otro alumno';
  await user.save();
  assert.equal(user.password, hash, 'no vuelve a hashear sin cambio de password');
  user.password = 'NuevaPassword_123';
  await user.save();
  assert.equal(await user.comparePassword('NuevaPassword_123'), true);
});

test('rechaza usuario duplicado, tipos no válidos y passwords fuera del límite bcrypt', async () => {
  await request(app).post('/api/users').send({ username: 'ALUMNO', password: 'Password_123', email: 'a@example.test' }).expect(409);
  for (const data of [
    { username: { $ne: null }, password: 'Password_123' },
    { username: 'alumno', password: { $ne: null } },
    { username: 'corto', password: '123' },
    { username: 'largo', password: 'á'.repeat(37) },
    { username: 'correo', password: 'Password_123', email: 'incorrecto' }
  ]) await request(app).post('/api/users').send(data).expect(400);
});

test('login: error genérico para usuario inexistente y contraseña incorrecta', async () => {
  const a = await request(app).post('/api/users/signin').send({ username: 'nadie', password: 'Password_123' }).expect(401);
  const b = await request(app).post('/api/users/signin').send({ username: 'alumno', password: 'Password_123' }).expect(401);
  assert.deepEqual(a.body, b.body);
});

test('JWT dura una hora y da acceso al perfil sin exponer el hash', async () => {
  const claims = jwt.verify(token, process.env.TOKEN_SECRET, { algorithms: ['HS256'] });
  assert.equal(claims.exp - claims.iat, 3600);
  assert.equal(claims.username, 'alumno');
  assert.equal(claims.password, undefined);
  const r = await request(app).get('/api/users/secure').set('Authorization', `Bearer ${token}`).expect(200);
  assert.equal(r.body.data._id, claims.sub);
  assert.equal(r.body.data.password, undefined);
});

test('rechaza ausencia de cabecera, esquema incorrecto y tokens manipulados o caducados', async () => {
  const payload = { username: 'alumno', sub: '64b7f0f2f2f2f2f2f2f2f2f2' };
  const expired = jwt.sign(payload, process.env.TOKEN_SECRET, { expiresIn: -1 });
  const wrongKey = jwt.sign(payload, 'otra-clave', { expiresIn: 3600 });
  const wrongAlgorithm = jwt.sign(payload, process.env.TOKEN_SECRET, { algorithm: 'HS384', expiresIn: 3600 });
  const unsigned = jwt.sign(payload, null, { algorithm: 'none', expiresIn: 3600 });
  const noExpiry = jwt.sign(payload, process.env.TOKEN_SECRET);
  const parts = token.split('.');
  parts[1] = Buffer.from(JSON.stringify({ ...jwt.decode(token), username: 'admin' })).toString('base64url');
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

test('limita los intentos de registro y login', async () => {
  let status;
  for (let i = 0; i < 31; i++) status = (await request(app).post('/api/users/signin').send({})).status;
  assert.equal(status, 429);
});
