const mongoose = require('mongoose');
// Estado transitorio compartido por las instancias de la API; un solo uso.
const schema = new mongoose.Schema({
  stateHash: { type: String, required: true, unique: true },
  browserHash: { type: String, required: true },
  codeVerifier: { type: String, required: true },
  nonce: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { collection: 'oauth_login_attempts' });
module.exports = mongoose.model('OAuthAttempt', schema);
