// Devuelve un objeto solo con los campos permitidos que vengan en el cuerpo
module.exports = (body, fields) =>
  Object.fromEntries(fields.filter((f) => body && body[f] !== undefined).map((f) => [f, body[f]]));
