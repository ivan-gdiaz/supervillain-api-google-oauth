const mongoose = require('mongoose');
const { Schema } = mongoose;

const minionSchema = new Schema({
  lair:       { type: Schema.ObjectId, ref: 'Lair', required: true },
  name:       { type: String, required: true, trim: true },
  eyeCount:   { type: Number, default: 2, min: 0 },
  expendable: { type: Boolean, default: true }
});

module.exports = mongoose.model('Minion', minionSchema);
