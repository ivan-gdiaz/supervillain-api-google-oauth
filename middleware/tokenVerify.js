const jwt = require('jsonwebtoken');
const auth = require('../config/auth');
// Mismo papel que tokenVerify en moviesAppAuth/routes/users.js, reutilizable.
function tokenVerify(req, res, next) {
  const authHeader = req.get('authorization') || '';
  const match = /^Bearer ([^\s]+)$/i.exec(authHeader);
  if (!match) return unauthorized(res);
  jwt.verify(match[1], auth.secret, { algorithms: [auth.algorithm] }, (err, payload) => {
    if (err || typeof payload !== 'object' || !payload ||
        !/^[a-f\d]{24}$/i.test(payload.sub || '') || typeof payload.username !== 'string' ||
        !Number.isFinite(payload.exp)) return unauthorized(res);
    req.user = payload;
    next();
  });
}
function unauthorized(res) {
  return res.set('WWW-Authenticate', 'Bearer').status(401)
    .json({ ok: false, message: 'Token ausente, inválido o caducado' });
}
module.exports = tokenVerify;
