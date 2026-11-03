const mongoose = require('mongoose');
const { Schema } = mongoose;

const villainSchema = new Schema({
  name:      { type: String, required: true, trim: true },
  alias:     { type: String, required: true, trim: true },
  evilLevel: { type: Number, required: true, min: 0, validate: Number.isInteger },
  created:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('Villain', villainSchema);
