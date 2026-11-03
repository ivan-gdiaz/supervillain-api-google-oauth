// CRUD original, ahora con un JWT real y MongoDB temporal aislado.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { connect, disconnect, authenticate } = require('./helpers');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
let token;
before(async () => { await connect(); token = await authenticate(app); });
after(disconnect);
const api = Object.fromEntries(['get', 'post', 'put', 'delete'].map(method =>
  [method, path => request(app)[method](path).set('Authorization', `Bearer ${token}`)]));

const ghost = '64b7f0f2f2f2f2f2f2f2f2f2';
let villain, lair, minion, device;

test('POST /api/villains valida y crea', async () => {
  let r = await api.post('/api/villains').send({ alias: 'x', evilLevel: 1 });
  assert.equal(r.status, 400);
  r = await api.post('/api/villains').send({ name: 'a', alias: 'b', evilLevel: -3 });
  assert.equal(r.status, 400);
  r = await api.post('/api/villains').send({ name: '  Gru ', alias: 'El Ladrón de la Luna', evilLevel: 8000, hack: 'ignorado' });
  assert.equal(r.status, 201);
  assert.equal(r.body.data.name, 'Gru');
  assert.equal(r.body.data.hack, undefined);
  villain = r.body.data;
});

test('GET villanos: lista, uno, 404 y 400', async () => {
  let r = await api.get('/api/villains');
  assert.equal(r.status, 200);
  assert.equal(r.body.data.length, 1);
  r = await api.get(`/api/villains/${villain._id}`);
  assert.equal(r.body.alias, 'El Ladrón de la Luna');
  assert.equal((await api.get(`/api/villains/${ghost}`)).status, 404);
  assert.equal((await api.get('/api/villains/xx')).status, 400);
});

test('PUT villano', async () => {
  const r = await api.put(`/api/villains/${villain._id}`).send({ evilLevel: 8500 });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.evilLevel, 8500);
  assert.equal((await api.put(`/api/villains/${villain._id}`).send({ evilLevel: -1 })).status, 400);
});

test('guaridas anidadas bajo un villano', async () => {
  let r = await api.post(`/api/villains/${villain._id}/lairs`).send({ name: 'Volcán Inactivo #4', location: 'Isla de Pascua' });
  assert.equal(r.status, 201);
  lair = r.body.data;
  assert.equal(lair.villain, villain._id);
  assert.equal((await api.post(`/api/villains/${villain._id}/lairs`).send({ location: 'x' })).status, 400);
  assert.equal((await api.post(`/api/villains/${ghost}/lairs`).send({ name: 'x' })).status, 404);
  r = await api.get(`/api/villains/${villain._id}/lairs`);
  assert.equal(r.body.data.length, 1);
  r = await api.get(`/api/villains/${villain._id}/lairs/${lair._id}`);
  assert.equal(r.body.villain.name, 'Gru');   // populate
  r = await api.put(`/api/villains/${villain._id}/lairs/${lair._id}`).send({ location: 'Luna' });
  assert.equal(r.body.data.location, 'Luna');
});

test('una guarida no se puede usar desde otro villano', async () => {
  const otro = (await api.post('/api/villains').send({ name: 'Vector', alias: 'Oh yeah', evilLevel: 5 })).body.data;
  const r = await api.get(`/api/villains/${otro._id}/lairs/${lair._id}/minions`);
  assert.equal(r.status, 404);
});

test('esbirros: crear, defaults, modificar y borrar', async () => {
  const base = `/api/villains/${villain._id}/lairs/${lair._id}/minions`;
  let r = await api.post(base).send({ name: 'Bob' });
  assert.equal(r.status, 201);
  assert.equal(r.body.data.eyeCount, 2);
  assert.equal(r.body.data.expendable, true);
  minion = r.body.data;
  r = await api.put(`${base}/${minion._id}`).send({ eyeCount: 1 });
  assert.equal(r.body.data.eyeCount, 1);
  r = await api.get(base);
  assert.equal(r.body.data.length, 1);
  assert.equal((await api.delete(`${base}/${minion._id}`)).status, 200);
  assert.equal((await api.delete(`${base}/${minion._id}`)).status, 404);
});

test('máquinas: enum de status', async () => {
  const base = `/api/villains/${villain._id}/lairs/${lair._id}/devices`;
  assert.equal((await api.post(base).send({ name: 'x', status: 'Rota' })).status, 400);
  const r = await api.post(base).send({ name: 'Rayo Encogedor', status: 'Cargando', power: '1.21 Gigawatts' });
  assert.equal(r.status, 201);
  device = r.body.data;
  assert.equal((await api.get(base)).body.data.length, 1);
});

test('borrar un villano elimina en cascada guaridas, esbirros y máquinas', async () => {
  await api.post(`/api/villains/${villain._id}/lairs/${lair._id}/minions`).send({ name: 'Kevin' });
  assert.equal((await api.delete(`/api/villains/${villain._id}`)).status, 200);
  assert.equal(await mongoose.model('Lair').countDocuments({ villain: villain._id }), 0);
  assert.equal(await mongoose.model('Minion').countDocuments({ lair: lair._id }), 0);
  assert.equal(await mongoose.model('Device').countDocuments({ lair: lair._id }), 0);
});

test('ruta inexistente: 404 en JSON', async () => {
  const r = await api.get('/api/nada');
  assert.equal(r.status, 404);
  assert.equal(r.body.error, 'Ruta no encontrada en el multiverso');
});
