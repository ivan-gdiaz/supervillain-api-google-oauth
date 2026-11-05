// Este test debe FALLAR hasta que el estudiante complete el TODO.
const { test, before, after } = require('node:test');
const { connect, disconnect, authenticate } = require('../test/helpers');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
let token;
before(async () => { await connect(); token = await authenticate(app); });
after(disconnect);
test('el listado rechaza peticiones sin token', async () => {
  await request(app).get('/api/villains').expect(401);
});
test('el listado rechaza un token inválido', async () => {
  await request(app).get('/api/villains').set('Authorization', 'Bearer incorrecto').expect(401);
});
test('el listado rechaza un token caducado', async () => {
  const expired = jwt.sign({ provider: 'google', sub: jwt.decode(token).sub, iss: 'villainlair-api', aud: 'villainlair-client' }, process.env.TOKEN_SECRET, { expiresIn: -1 });
  await request(app).get('/api/villains').set('Authorization', `Bearer ${expired}`).expect(401);
});
test('un token válido permite listar; health y acceso con Google siguen disponibles', async () => {
  await request(app).get('/api/villains').set('Authorization', `Bearer ${token}`).expect(200);
  await request(app).get('/health').expect(200);
  await authenticate(app);
});
