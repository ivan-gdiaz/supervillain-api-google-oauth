const express = require('express');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { rateLimit } = require('express-rate-limit');
const User = require('../models/User');
const OAuthAttempt = require('../models/OAuthAttempt');
const provider = require('../services/google');
const google = require('../config/google');
const auth = require('../config/auth');
const router = express.Router();
const cookieName = 'oauth_browser';
const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: google.secureCookie, path: '/api/auth/google' };
const random = () => crypto.randomBytes(32).toString('base64url');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const validRandom = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

router.use((req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
  next();
});
router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 60,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Demasiados intentos. Vuelve a intentarlo en 15 minutos.' }
}));

router.get('/google', async (req, res, next) => {
  const state = random();
  const browser = random();
  const attempt = { stateHash: hash(state), browserHash: hash(browser),
    codeVerifier: random(), nonce: random(), expiresAt: new Date(Date.now() + 10 * 60 * 1000) };
  let url;
  try { url = await provider.authorizationUrl({ ...attempt, state }); }
  catch { return res.status(502).json({ error: 'No se pudo iniciar el acceso con Google.' }); }
  try {
    await OAuthAttempt.create(attempt);
    res.cookie(cookieName, browser, { ...cookieOptions, maxAge: 10 * 60 * 1000 });
    res.redirect(url.toString());
  } catch (error) { next(error); }
});

router.get('/google/callback', async (req, res, next) => {
  const state = req.query.state;
  const browser = req.cookies[cookieName];
  if (!validRandom(state) || !validRandom(browser)) {
    return res.status(400).json({ error: 'Inicio de sesión ausente o no válido. Vuelve a entrar por /api/auth/google.' });
  }
  try {
    // Consumo atómico: evita repetir el callback incluso entre varias instancias.
    // El filtro de fecha es necesario: el borrado TTL de MongoDB no es inmediato.
    const attempt = await OAuthAttempt.findOneAndDelete({
      stateHash: hash(state), browserHash: hash(browser), expiresAt: { $gt: new Date() }
    });
    if (!attempt) return res.status(400).json({ error: 'Inicio de sesión caducado, usado o no válido.' });
    res.clearCookie(cookieName, cookieOptions);
    const callbackUrl = new URL(google.redirectUri);
    callbackUrl.search = new URL(req.originalUrl, google.redirectUri).search;
    let profile;
    try { profile = await provider.exchange(callbackUrl, attempt, state); }
    catch { return res.status(401).json({ error: 'No se pudo validar el acceso con Google. Inicia sesión de nuevo.' }); }
    let user;
    try {
      user = await User.findOneAndUpdate({ googleSub: profile.googleSub }, { $set: profile },
        { upsert: true, returnDocument: 'after', runValidators: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      user = await User.findOne({ googleSub: profile.googleSub });
      if (!user) throw error;
    }
    const token = jwt.sign({ provider: 'google' }, auth.secret, {
      subject: user.id, algorithm: auth.algorithm, expiresIn: auth.expiresIn,
      issuer: auth.issuer, audience: auth.audience
    });
    // JSON en el cuerpo: nunca poner tokens en URLs o parámetros de redirección.
    res.json({ token, tokenType: 'Bearer', expiresIn: auth.expiresIn, user: user.toJSON() });
  } catch (error) { next(error); }
});
module.exports = router;
