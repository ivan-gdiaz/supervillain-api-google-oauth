const mongoose = require('mongoose');
const { Schema } = mongoose;

const deviceSchema = new Schema({
  lair:   { type: Schema.ObjectId, ref: 'Lair', required: true },
  name:   { type: String, required: true, trim: true },
  status: { type: String, enum: ['Inactiva', 'Cargando', 'Lista'], default: 'Inactiva' },
  power:  { type: String, trim: true }
});

module.exports = mongoose.model('Device', deviceSchema);
