const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true,
    match: /^[a-z0-9_]{3,30}$/ },
  password: { type: String, required: true, select: false },
  fullname: { type: String, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  creationdate: { type: Date, default: Date.now }
});
// Como moviesAppAuth: hash antes de guardar y comparePassword en el modelo.
// Mongoose 9 usa promesas en este hook, en lugar del callback next antiguo.
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  if (this.password.length < 8 || Buffer.byteLength(this.password, 'utf8') > 72) {
    const error = new Error('La contraseña debe tener al menos 8 caracteres y un máximo de 72 bytes.');
    error.status = 400;
    throw error;
  }
  this.password = await bcrypt.hash(this.password, 10);
});
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};
// También al serializar un usuario recién creado: nunca devolver el hash.
userSchema.set('toJSON', { transform(doc, ret) { delete ret.password; delete ret.__v; return ret; } });
module.exports = mongoose.model('User', userSchema);
