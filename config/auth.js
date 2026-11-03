// La clave se configura al arrancar; nunca se publica en GitHub.
const secret = process.env.TOKEN_SECRET;
if (!secret || Buffer.byteLength(secret, 'utf8') < 32 || /CAMBIA|REEMPLAZA/i.test(secret)) {
  throw new Error('TOKEN_SECRET debe ser una clave aleatoria de al menos 32 bytes.');
}
module.exports = { secret, algorithm: 'HS256', expiresIn: 3600 };
