const express = require('express');
const User = require('../models/User');
const tokenVerify = require('../middleware/tokenVerify');
const router = express.Router();
// El registro y signin con contraseña han desaparecido. Solo queda el perfil.
router.get('/secure', tokenVerify, (req, res, next) => {
  User.findById(req.user.sub)
    .then((user) => user ? res.json({ data: user }) : res.status(401).json({ error: 'Usuario no disponible' }))
    .catch(next);
});
module.exports = router;
