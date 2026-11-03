// Carga datos de ejemplo. Uso: npm run seed   (o npm run seed -- --force para vaciar antes)
const mongoose = require('mongoose');
const Villain = require('../models/Villain');
const Lair = require('../models/Lair');
const Minion = require('../models/Minion');
const Device = require('../models/Device');

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Falta MONGODB_URI en el .env');
  await mongoose.connect(process.env.MONGODB_URI);

  if (await Villain.countDocuments() > 0) {
    if (!process.argv.includes('--force')) {
      console.log('La base de datos ya tiene villanos. Usa "npm run seed -- --force" para vaciarla y recargarla.');
      return;
    }
    await Promise.all([Villain, Lair, Minion, Device].map((m) => m.deleteMany({})));
  }

  const nefario = await Villain.create({ name: 'Dr. Nefario', alias: 'El Científico Loco', evilLevel: 9000 });
  await Villain.create({ name: 'Gru', alias: 'El Ladrón de la Luna', evilLevel: 8000 });
  const lair = await Lair.create({ villain: nefario._id, name: 'Volcán Inactivo #4', location: 'Isla de Pascua' });
  await Minion.create([
    { lair: lair._id, name: 'Bob', eyeCount: 2, expendable: true },
    { lair: lair._id, name: 'Kevin', eyeCount: 1, expendable: true }
  ]);
  await Device.create({ lair: lair._id, name: 'Rayo Encogedor', status: 'Cargando', power: '1.21 Gigawatts' });

  console.log('Datos de ejemplo cargados: 2 villanos, 1 guarida, 2 esbirros y 1 máquina.');
}

main()
  .catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
