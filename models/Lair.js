const mongoose = require('mongoose');
const { Schema } = mongoose;

const lairSchema = new Schema({
  villain:  { type: Schema.ObjectId, ref: 'Villain', required: true },
  name:     { type: String, required: true, trim: true },
  location: { type: String, trim: true }
});

module.exports = mongoose.model('Lair', lairSchema);
