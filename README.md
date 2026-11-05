# VillainLair API · Google OAuth / OpenID Connect

API docente de supervillanos, guaridas, esbirros y máquinas. **La identidad la comprueba Google** mediante OpenID Connect sobre OAuth 2.0. La API no recibe ni guarda contraseñas: después del acceso con Google devuelve un JWT propio, válido durante una hora, para usar los endpoints.

Base: [supervillain-api-simplificada](https://github.com/ivan-gdiaz/supervillain-api-simplificada). Se mantienen el CRUD y los routers anidados. Esta es la versión 2; sustituye el registro y signin locales de la versión 1.

**Ejercicio pendiente:** `GET /api/villains` sigue abierto deliberadamente. El alumnado debe protegerlo con `tokenVerify`, según [el enunciado](docs/EJERCICIO.md). El inicio OAuth, su callback y `/health` deben continuar públicos.

## Arranque local

Necesitas Node.js 24, MongoDB local o Atlas y un cliente OAuth de Google de tipo **Aplicación web**. Sigue [la configuración de Google y Render](docs/DESPLIEGUE.md).

```bash
git clone https://github.com/ivan-gdiaz/supervillain-api-jwt.git
cd supervillain-api-jwt
npm ci
cp .env.example .env
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Completa `.env`:

| Variable | Valor |
|---|---|
| `MONGODB_URI` | URI completa de tu base de datos |
| `TOKEN_SECRET` | Clave aleatoria generada; mínimo 32 bytes |
| `GOOGLE_CLIENT_ID` | ID del cliente OAuth de Google |
| `GOOGLE_CLIENT_SECRET` | Secreto del cliente; solo en el servidor |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3000/api/auth/google/callback` |
| `PORT` | `3000` |

Registra **esa misma URL exacta** en las URI de redirección autorizadas de Google. Añade tu cuenta como usuario de prueba cuando la aplicación esté en modo Testing.

```bash
npm run seed         # opcional: datos de negocio de práctica; no crea usuarios
npm run start:local  # carga .env
# npm run dev        # alternativa con recarga
```

En el navegador abre [el inicio de sesión local](http://localhost:3000/api/auth/google). Selecciona tu cuenta y acepta el consentimiento. Google devuelve al navegador al callback de la API, que responde con JSON:

```json
{
  "token": "JWT_DE_LA_API",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": { "_id": "...", "googleSub": "...", "email": "...", "fullname": "..." }
}
```

Copia el campo `token` para Postman, curl o [docs/peticiones.http](docs/peticiones.http). El JWT no se incluye en la URL de retorno ni se guarda en localStorage. Esta API docente devuelve JSON; no incluye una interfaz de usuario ni guarda sesiones duraderas en el navegador.

```bash
BASE=http://localhost:3000
TOKEN='PEGA_AQUI_EL_JWT_DE_LA_API'
curl -i "$BASE/api/users/secure" -H "Authorization: Bearer $TOKEN"
# 200: perfil del usuario autenticado

curl -i -X POST "$BASE/api/villains" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Gru","alias":"El Ladrón de la Luna","evilLevel":8000}'
# 201; la misma petición sin Authorization devuelve 401

curl -i "$BASE/api/villains"
# 200: excepción docente pendiente; tras el ejercicio debe ser 401
```

No se hace el login con un POST de usuario y contraseña. Abrir `/api/auth/google` en el navegador inicia el flujo completo. Al caducar el JWT, vuelve a entrar por Google.

## Cómo funciona

1. `GET /api/auth/google` crea `state`, `nonce` y un verificador PKCE aleatorios.
2. Guarda un intento efímero en MongoDB y una cookie de vinculación al navegador (`HttpOnly`, `SameSite=Lax`, `Secure` con HTTPS). Redirige a Google con scopes `openid email profile` y PKCE S256.
3. Google autentica al usuario. Su contraseña solo se introduce en Google.
4. El callback comprueba `state`, cookie, caducidad de diez minutos y uso único. Consume el intento atómicamente en MongoDB.
5. `openid-client` canjea el código y verifica el ID token de Google: firma mediante JWKS, algoritmo RS256, emisor, audiencia, caducidad y `nonce`. Se exige email verificado.
6. Busca o crea el perfil por el `sub` estable de Google, nunca por coincidencia de email.
7. Devuelve un JWT HS256 propio de VillainLair, con `sub` local, `provider: google`, `iss: villainlair-api`, `aud: villainlair-client`, `iat` y `exp`.
8. `tokenVerify` exige ese JWT en las rutas protegidas. Los tokens de Google y los JWT de la versión anterior no sirven como credencial de la API.

[OpenID Connect de Google](https://developers.google.com/identity/openid-connect/openid-connect) es la capa de autenticación sobre OAuth 2.0. El ID token identifica al usuario; un access token de Google autoriza acceso a servicios de Google. Esta práctica descarta los tokens de Google y no solicita acceso offline ni permisos para Drive, Gmail u otros servicios.

## Endpoints

| Método y ruta | Acceso |
|---|---|
| `GET /api/auth/google` | Público: redirige al login de Google |
| `GET /api/auth/google/callback` | Público, pero exige un flujo OAuth válido iniciado desde ese navegador |
| `GET /api/users/secure` | JWT propio: perfil actual |
| `GET /health` | Público: 200 si MongoDB está disponible; 503 si no |
| `GET /api/villains` | **Público como ejercicio pendiente** (también HEAD de Express) |
| `POST /api/villains` | JWT |
| `GET / PUT / DELETE /api/villains/:villainId` | JWT |
| Todas las operaciones de guaridas, esbirros y máquinas | JWT en el router padre |
| `POST /api/users` y `POST /api/users/signin` | Eliminados: 404 |

Las rutas anidadas son `/api/villains/:villainId/lairs`, `.../lairs/:lairId/minions` y `.../lairs/:lairId/devices`. Conservan sus operaciones GET, POST, PUT y DELETE. Los modelos de negocio no cambian.

## Despliegue y actualización desde v1

[Guía de Google Cloud + Render + Atlas](docs/DESPLIEGUE.md). `render.yaml` incluye las nuevas variables; `npm start` usa las variables del proceso y no requiere `.env`.

Configura las tres variables `GOOGLE_*` **antes de desplegar**: el arranque las valida. Registra el callback HTTPS de tu servicio en Google. En un Blueprint ya existente, los valores `sync: false` deben configurarse en Environment; no se rellenan automáticamente por hacer push.

Los nuevos perfiles se guardan en **`oauth_users`**. La colección antigua `users`, incluidos sus hashes, queda sin utilizar y no se borra automáticamente. No hay migración por correo ni asociación automática entre cuentas. Si no necesitas los datos de la versión anterior, puedes retirarlos tras revisarlos y respaldarlos. Los villanos y sus recursos permanecen intactos.

Los JWT antiguos dejan de aceptarse por el nuevo contrato de emisor, audiencia y proveedor; cada usuario debe entrar mediante Google. Se ha eliminado la dependencia `bcryptjs`.

## Pruebas

```bash
npm test
npm run test:exercise  # tres pruebas fallan deliberadamente hasta proteger el listado
```

MongoDB temporal se descarga en la primera ejecución: no se usa Atlas. Los tests no necesitan credenciales reales de Google. Las pruebas de rutas simulan el proveedor; las de protocolo usan `openid-client` real, claves RSA, ID tokens firmados y JWKS simulados para comprobar aceptación y rechazo criptográfico. También se prueban state, cookie, replay, expiración, denegación de consentimiento, perfiles y CRUD. Esto no sustituye probar tu cliente OAuth real después de configurarlo.

## Estructura

- `routes/auth.js`: inicio OAuth, callback y emisión del JWT de la API.
- `services/google.js`: discovery OIDC, PKCE, canje de código y validación del ID token.
- `config/google.js`: credenciales y validación del callback registrado.
- `models/User.js`: perfil de Google en `oauth_users`, sin password.
- `models/OAuthAttempt.js`: intento de login efímero con índice TTL.
- `middleware/tokenVerify.js`: JWT propio en las rutas de negocio.
- `docs/GUIA_OAUTH.md`: explicación didáctica de la nueva versión.

## Alcance docente

La autenticación identifica al usuario; **no hay roles ni permisos por propietario**. Cualquier cuenta de Google autorizada por tu configuración de consentimiento puede acceder a todos los recursos protegidos. Utiliza datos de práctica. No hay restricción de dominio universitario.

No hay refresh tokens ni logout/revocación de JWT de la API. Cerrar sesión en Google o borrar el token en el cliente no invalida un JWT ya emitido: dura como máximo una hora. El middleware no consulta en cada petición si el perfil aún existe. Rotar `TOKEN_SECRET` invalida todos los JWT propios.

Se admite un login pendiente por navegador; iniciar otro reemplaza la cookie. Los intentos caducan en diez minutos. El limitador OAuth permite 60 peticiones cada 15 minutos por IP e instancia; su contador es local. Los intentos OAuth sí se comparten en MongoDB. Las rutas OAuth se excluyen del logger de peticiones para evitar registrar códigos y state; revisa también los logs de cualquier proxy externo.

## Material anterior

El [PowerPoint v1](docs/transparencias/historico/SSIIUU_Autenticacion_VillainLair_JWT_v1_password.pptx) es **histórico**: explica usuario/contraseña y bcrypt, que ya no se usan. Para esta versión sigue [la guía OAuth](docs/GUIA_OAUTH.md). Los ficheros históricos no son instrucciones de despliegue vigentes.

Referencias: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [openid-client](https://github.com/panva/openid-client), [Blueprints de Render](https://render.com/docs/blueprint-spec). El diseño inicial de la versión 1 se inspiró en [moviesAppAuth/master](https://github.com/ivan-gdiaz/moviesAppAuth/tree/master).
