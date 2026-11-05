const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_REDIRECT_URI;
if (!clientId || !clientSecret || !redirectUri) {
  throw new Error('Configura GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REDIRECT_URI.');
}
const url = new URL(redirectUri);
const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
if ((url.protocol !== 'https:' && !local) || (process.env.NODE_ENV === 'production' && local) ||
    url.username || url.password || url.search || url.hash || url.pathname !== '/api/auth/google/callback') {
  throw new Error('GOOGLE_REDIRECT_URI debe ser HTTPS (HTTP solo en localhost durante desarrollo) y terminar en /api/auth/google/callback.');
}
module.exports = { clientId, clientSecret, redirectUri, secureCookie: url.protocol === 'https:' };
