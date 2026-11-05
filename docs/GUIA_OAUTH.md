# Práctica guiada: autenticación delegada en Google

Esta guía corresponde a la versión 2 y sustituye las instrucciones de registro y bcrypt del PowerPoint histórico.

## 1. Separar identidad y acceso a la API

Antes la API comprobaba una contraseña contra un hash almacenado. Ahora Google realiza esa comprobación. VillainLair sigue necesitando identificar al usuario de cada petición, por eso emite su propio JWT después de validar la identidad confirmada por Google.

```text
Navegador → /api/auth/google → Google (login y consentimiento)
Google → /api/auth/google/callback?code=...&state=...
API → Google: canje del código con PKCE y credenciales del cliente
Google → API: ID token firmado
API → Navegador: JWT propio de VillainLair en el cuerpo JSON
Cliente → API: Authorization: Bearer JWT_DE_VILLAINLAIR
```

OAuth 2.0 define la delegación de autorización. OpenID Connect añade identidad e ID tokens. Usamos `openid email profile` para identificar al usuario, sin acceso a sus documentos ni correo.

## 2. Configurar el cliente OAuth

Sigue `DESPLIEGUE.md`. Distingue:

- Client ID: identifica a esta aplicación ante Google.
- Client secret: secreto del servidor para el canje del código.
- Redirect URI: dirección exacta a la que Google devuelve al navegador.
- TOKEN_SECRET: clave distinta, con la que VillainLair firma sus propios JWT.

## 3. Iniciar la autenticación

Lee `routes/auth.js`, ruta `GET /google`. Genera valores aleatorios y guarda un intento de diez minutos en `oauth_login_attempts`. La cookie HttpOnly vincula el intento con ese navegador. `services/google.js` construye la URL de Google con la librería `openid-client`.

`state` relaciona petición y respuesta y ayuda a impedir login CSRF. `nonce` relaciona el ID token con este inicio. PKCE envía primero un desafío S256 y, solo al canjear el código, su verificador. La API nunca acepta un emisor o URL de retorno aportados por el navegador.

## 4. Procesar el retorno

La ruta `GET /google/callback` consume el intento mediante `findOneAndDelete`, comprobando state, cookie y fecha. Así no se puede reutilizar, ni siquiera en otra instancia del servidor. Un índice TTL limpia intentos abandonados; la validación de caducidad no depende de que esa limpieza ya haya ocurrido.

El servicio canjea el código y comprueba el ID token, incluidas firma, audiencia, emisor, expiración y nonce. `enableNonRepudiationChecks` activa la verificación criptográfica de la firma mediante las claves públicas JWKS. Si falla, no se crea un perfil ni se entrega un JWT.

## 5. Guardar el perfil

Lee `models/User.js`. No hay `password`, bcrypt ni hook de hash. El usuario se identifica por `googleSub`, el `sub` estable que Google ha firmado. El correo puede cambiar; no se utiliza como identificador ni para vincular cuentas antiguas.

Solo guardamos id de Google, correo verificado, nombre y fecha de creación. Los tokens de acceso y de identidad de Google se descartan tras validar el login.

## 6. Emitir el JWT de VillainLair

La API firma un JWT de una hora. `sub` es el id del perfil local; `provider`, `iss` y `aud` permiten exigir el contrato de esta versión. El JWT va en el cuerpo JSON del callback y después en `Authorization: Bearer ...`.

El ID token de Google sirve para el login; el JWT propio sirve para consumir VillainLair. No son intercambiables. `tokenVerify` protege las mismas rutas CRUD que antes.

## 7. Comprobar el comportamiento

Haz login en el navegador y copia el JWT. Compara una petición al perfil con y sin Authorization. Repite el callback ya utilizado: debe rechazarse. Si abres el callback en otro navegador, no tiene la cookie del intento y debe rechazarse.

Ejecuta `npm test`: las pruebas de protocolo usan tokens RS256 firmados y un proveedor simulado para probar también los rechazos de firma, audiencia, nonce, emisor y expiración. No se simula una aprobación de Google en producción.

## 8. Completar el ejercicio

`GET /api/villains` sigue público. Aplica `tokenVerify` y ejecuta `npm run test:exercise`. Mantén públicos el inicio OAuth, su callback y `/health`. El callback es público en cuanto a JWT, pero exige todas las comprobaciones del flujo OAuth.

Pregunta para discutir: ¿identificarse con Google autoriza a modificar cualquier villano? En esta práctica todos los usuarios tienen el mismo acceso; los permisos por propietario serían una ampliación independiente.
