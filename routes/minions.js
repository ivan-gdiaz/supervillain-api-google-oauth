const express = require('express');
const router = express.Router({ mergeParams: true });
const Minion = require('../models/Minion');
const pick = require('../utils/pick');

const FIELDS = ['name', 'eyeCount', 'expendable'];

// Middleware: busca el esbirro de la URL, comprobando que pertenece a la guarida (req.lair)
function loadMinion(req, res, next) {
  Minion.findOne({ _id: req.params.minionId, lair: req.lair._id })
    .then((minion) => {
      if (!minion) return res.status(404).json({ error: "Esbirro no encontrado." });
      req.minion = minion;
      next();
    })
    .catch(next);
}

// GET: /villains/:villainId/lairs/:lairId/minions
router.get('/', (req, res, next) => {
  Minion.find({ lair: req.lair._id })
    .then((minions) => res.json({ data: minions }))
    .catch(next);
});

// POST: reclutar a un esbirro
router.post('/', (req, res, next) => {
  Minion.create({ ...pick(req.body, FIELDS), lair: req.lair._id })
    .then((minion) => res.status(201).json({ message: "Nuevo esbirro reclutado. Dice «¡Bello!».", data: minion }))
    .catch(next);
});

// GET: un esbirro concreto
router.get('/:minionId', loadMinion, (req, res) => {
  res.json(req.minion);
});

// PUT: ascender o modificar a un esbirro
router.put('/:minionId', loadMinion, (req, res, next) => {
  req.minion.set(pick(req.body, FIELDS));
  req.minion.save()
    .then((minion) => res.json({ message: "Esbirro modificado genéticamente con éxito.", data: minion }))
    .catch(next);
});

// DELETE: despedir a un esbirro
router.delete('/:minionId', loadMinion, (req, res, next) => {
  req.minion.deleteOne()
    .then(() => res.json({ message: "Esbirro lanzado al foso de los cocodrilos exitosamente." }))
    .catch(next);
});

module.exports = router;
