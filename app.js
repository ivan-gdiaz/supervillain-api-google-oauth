const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const mongoose = require('mongoose');

const villainsRouter = require('./routes/villains');
const usersRouter = require('./routes/users');

const app = express();

// La conexión se inicia en bin/www antes de escuchar peticiones.
if (process.env.RENDER === 'true') app.set('trust proxy', 1);
app.disable('x-powered-by');

if (process.env.NODE_ENV !== 'test') app.use(logger('dev'));
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Montamos la ruta raíz de nuestra jerarquía
app.get('/health', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'unavailable' });
});
app.use('/api/users', usersRouter);
app.use('/api/villains', villainsRouter);

// Catch 404
app.use(function (req, res, next) {
  res.status(404).json({ error: "Ruta no encontrada en el multiverso" });
});

// Error handler (JSON en lugar de vista)
app.use(function (err, req, res, next) {
  const invalid = err.name === 'ValidationError' || err.name === 'CastError';
  if (err.code === 11000) return res.status(409).json({ error: 'El usuario ya existe' });
  const status = err.status || (invalid ? 400 : 500);
  // La validación puede incluir el valor rechazado: no devolverlo.
  const message = invalid ? 'Datos o identificador no válidos' :
    status >= 500 ? 'Error interno del servidor' :
    err.type === 'entity.parse.failed' ? 'JSON no válido' :
    err.type === 'entity.too.large' ? 'Cuerpo de petición demasiado grande' : err.message;
  res.status(status).json({ error: message });
});

module.exports = app;
