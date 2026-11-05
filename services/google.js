const oidc = require('openid-client');
const google = require('../config/google');
let discovery;
async function configuration() {
  if (!discovery) {
    discovery = oidc.discovery(new URL('https://accounts.google.com'), google.clientId,
      { client_secret: google.clientSecret, id_token_signed_response_alg: 'RS256' },
      oidc.ClientSecretPost(google.clientSecret), { timeout: 10 })
      .then((config) => { oidc.enableNonRepudiationChecks(config); return config; })
      .catch((error) => { discovery = undefined; throw error; });
  }
  return discovery;
}
// La factoría permite probar el protocolo con un servidor simulado y claves de prueba.
function createProvider(getConfiguration = configuration) {
  return {
    async authorizationUrl({ state, nonce, codeVerifier }) {
      return oidc.buildAuthorizationUrl(await getConfiguration(), {
        redirect_uri: google.redirectUri, scope: 'openid email profile',
        response_type: 'code', state, nonce,
        code_challenge: await oidc.calculatePKCECodeChallenge(codeVerifier),
        code_challenge_method: 'S256', prompt: 'select_account'
      });
    },
    async exchange(callbackUrl, attempt, state) {
      const tokens = await oidc.authorizationCodeGrant(await getConfiguration(), callbackUrl, {
        pkceCodeVerifier: attempt.codeVerifier, expectedState: state,
        expectedNonce: attempt.nonce, idTokenExpected: true
      });
      // openid-client valida emisor, audiencia, caducidad, nonce y firma (JWKS).
      const claims = tokens.claims();
      if (!claims || typeof claims.sub !== 'string' || !claims.sub ||
          typeof claims.email !== 'string' || !claims.email || claims.email_verified !== true) {
        throw new Error('Google no ha confirmado la identidad o el email.');
      }
      // No guardamos access_token, refresh_token ni id_token de Google.
      return { googleSub: claims.sub, email: claims.email,
        fullname: typeof claims.name === 'string' ? claims.name : '' };
    }
  };
}
module.exports = { ...createProvider(), createProvider };
