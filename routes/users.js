const express = require('express');
const jwt = require('jsonwebtoken');
const { rateLimit } = require('express-rate-limit');
const User = require('../models/User');
const tokenVerify = require('../middleware/tokenVerify');
const auth = require('../config/auth');
const pick = require('../utils/pick');
const router = express.Router();
// Protección básica contra intentos repetidos; memoria local por instancia.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Demasiados intentos. Vuelve a intentarlo en 15 minutos.' }
});
function validateCredentials(req, res, next) {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || !/^[a-z0-9_]{3,30}$/i.test(username.trim()) ||
      typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ error: 'Usuario: 3–30 letras, números o _. Contraseña: mínimo 8 caracteres, máximo 72 bytes.' });
  }
  req.body.username = username.trim().toLowerCase();
  next();
}
// Registro público, como POST /users en moviesAppAuth.
router.post('/', authLimiter, validateCredentials, (req, res, next) => {
  if (typeof req.body.email !== 'string' ||
      (req.body.fullname !== undefined && typeof req.body.fullname !== 'string')) {
    return res.status(400).json({ error: 'email es obligatorio; fullname debe ser texto.' });
  }
  User.create(pick(req.body, ['username', 'password', 'fullname', 'email']))
    .then((user) => res.status(201).json({ message: 'Usuario registrado', data: user }))
    .catch(next);
});
// Dos pasos como en la referencia: comprobar credenciales y generar el JWT.
router.post('/signin', authLimiter, validateCredentials, (req, res, next) => {
  User.findOne({ username: req.body.username }).select('+password')
    .then(async (user) => {
      if (!user || !(await user.comparePassword(req.body.password))) {
        return res.status(401).json({ message: 'Credenciales incorrectas' });
      }
      req.authenticatedUser = user;
      next();
    }).catch(next);
}, (req, res, next) => {
  const user = req.authenticatedUser;
  jwt.sign({ username: user.username }, auth.secret, {
    subject: user.id, algorithm: auth.algorithm, expiresIn: auth.expiresIn
  }, (err, token) => {
    if (err) return next(err);
    res.set('Cache-Control', 'no-store').json({ token, tokenType: 'Bearer', expiresIn: auth.expiresIn });
  });
});
// Solo el perfil autenticado, nunca el listado de usuarios.
router.get('/secure', tokenVerify, (req, res, next) => {
  User.findById(req.user.sub)
    .then((user) => user ? res.json({ data: user }) : res.status(401).json({ error: 'Usuario no disponible' }))
    .catch(next);
});
module.exports = router;
