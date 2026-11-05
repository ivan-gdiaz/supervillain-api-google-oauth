const mongoose = require('mongoose');
// Colección nueva: no reutilizar cuentas locales ni asociarlas por email.
const userSchema = new mongoose.Schema({
  googleSub: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  fullname: { type: String, default: '' },
  creationdate: { type: Date, default: Date.now }
}, { collection: 'oauth_users' });
userSchema.set('toJSON', { transform(doc, ret) { delete ret.__v; return ret; } });
module.exports = mongoose.model('User', userSchema);
