const express = require('express');
// mergeParams es OBLIGATORIO para leer req.params.villainId del router padre
const router = express.Router({ mergeParams: true });
const Lair = require('../models/Lair');
const Minion = require('../models/Minion');
const Device = require('../models/Device');
const minionsRouter = require('./minions');
const devicesRouter = require('./devices');
const pick = require('../utils/pick');

const FIELDS = ['name', 'location'];

// Middleware: busca la guarida de la URL, comprobando que pertenece al villano (req.villain)
function loadLair(req, res, next) {
  Lair.findOne({ _id: req.params.lairId, villain: req.villain._id })
    .then((lair) => {
      if (!lair) return res.status(404).json({ error: "Guarida no encontrada" });
      req.lair = lair;
      next();
    })
    .catch(next);
}

// Anidación de 3er nivel: esbirros y máquinas dentro de una guarida
router.use('/:lairId/minions', loadLair, minionsRouter);
router.use('/:lairId/devices', loadLair, devicesRouter);

// GET: listar guaridas de un villano específico
router.get('/', (req, res, next) => {
  Lair.find({ villain: req.villain._id })
    .then((lairs) => res.json({ message: `Guaridas del villano ${req.villain.name}`, data: lairs }))
    .catch(next);
});

// POST: construir nueva guarida (el villano sale de la URL, no del cuerpo)
router.post('/', (req, res, next) => {
  Lair.create({ ...pick(req.body, FIELDS), villain: req.villain._id })
    .then((lair) => res.status(201).json({ message: "Nueva guarida secreta construida. Shhh.", data: lair }))
    .catch(next);
});

// GET: una guarida, con los datos de su villano
router.get('/:lairId', loadLair, (req, res, next) => {
  req.lair.populate('villain')
    .then((lair) => res.json(lair))
    .catch(next);
});

// PUT: reformar una guarida
router.put('/:lairId', loadLair, (req, res, next) => {
  req.lair.set(pick(req.body, FIELDS));
  req.lair.save()
    .then((lair) => res.json({ message: "Guarida reformada. Ahora con más trampillas.", data: lair }))
    .catch(next);
});

// DELETE: demoler una guarida con sus esbirros y máquinas
router.delete('/:lairId', loadLair, (req, res, next) => {
  Minion.deleteMany({ lair: req.lair._id })
    .then(() => Device.deleteMany({ lair: req.lair._id }))
    .then(() => req.lair.deleteOne())
    .then(() => res.json({ message: "Guarida demolida. Solo quedan cenizas." }))
    .catch(next);
});

module.exports = router;
