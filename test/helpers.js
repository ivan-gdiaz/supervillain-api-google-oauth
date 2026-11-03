// MongoDB temporal: nunca conecta con Atlas ni borra bases del usuario.
process.env.NODE_ENV = 'test';
process.env.TOKEN_SECRET = require('node:crypto').randomBytes(48).toString('hex');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
let database;
async function connect() {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri('villainlair_test'));
  await require('../models/User').init();
}
async function disconnect() {
  await mongoose.disconnect();
  if (database) await database.stop();
}
async function authenticate(app) {
  const credentials = { username: 'alumno', password: 'SoloPruebas_2026' };
  await request(app).post('/api/users').send({ ...credentials, email: 'alumno@example.test' }).expect(201);
  const response = await request(app).post('/api/users/signin').send(credentials).expect(200);
  return response.body.token;
}
module.exports = { connect, disconnect, authenticate };
