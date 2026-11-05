// MongoDB temporal: nunca conecta con Atlas ni borra bases del usuario.
process.env.NODE_ENV = 'test';
process.env.TOKEN_SECRET = require('node:crypto').randomBytes(48).toString('hex');
process.env.GOOGLE_CLIENT_ID = 'test.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'secreto-ficticio-para-pruebas';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
let database;
async function connect() {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri('villainlair_test'));
  await Promise.all([require('../models/User').init(), require('../models/OAuthAttempt').init()]);
}
async function disconnect() {
  await mongoose.disconnect();
  if (database) await database.stop();
}
// Solo en tests: sustituir la frontera de Google, no la protección ni la persistencia.
// google.test.js prueba aparte el protocolo real con JWT RS256 y JWKS simulados.
async function authenticate(app) {
  const provider = require('../services/google');
  const original = { authorizationUrl: provider.authorizationUrl, exchange: provider.exchange };
  provider.authorizationUrl = async ({ state }) => new URL(`https://accounts.google.com/o/oauth2/v2/auth?state=${state}`);
  provider.exchange = async () => ({ googleSub: 'test-google-alumno', email: 'alumno@example.test', fullname: 'Alumno' });
  try {
    const agent = request.agent(app);
    const start = await agent.get('/api/auth/google').expect(302);
    const state = new URL(start.headers.location).searchParams.get('state');
    const response = await agent.get('/api/auth/google/callback').query({ state, code: 'test-code' }).expect(200);
    return response.body.token;
  } finally { Object.assign(provider, original); }
}
module.exports = { connect, disconnect, authenticate };
