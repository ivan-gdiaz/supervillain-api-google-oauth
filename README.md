# VillainLair API · JWT

API docente de supervillanos, guaridas, esbirros y máquinas. Express + Mongoose + MongoDB Atlas, con autenticación muy similar a [moviesAppAuth (rama master)](https://github.com/ivan-gdiaz/moviesAppAuth/tree/master).

Base: [supervillain-api-simplificada](https://github.com/ivan-gdiaz/supervillain-api-simplificada). Se mantienen sus modelos, rutas anidadas y operaciones CRUD. Este repositorio empieza con un historial limpio: no arrastra credenciales del repositorio de origen.

**Ejercicio pendiente:** `GET /api/villains` está deliberadamente abierto. El alumnado debe protegerlo; ver [enunciado y comprobaciones](docs/EJERCICIO.md). Express también atiende HEAD a través de esta ruta GET. Registro, login y `/health` son públicos por diseño.

## Transparencias

[PowerPoint de la práctica: 32 diapositivas](docs/transparencias/SSIIUU_Autenticacion_VillainLair_JWT.pptx), con el estilo de SSIIUU_Despliegue_VillainLair_Render_Atlas, ejemplos y notas para el docente.

## Arranque local

Node.js 24 (ver `.nvmrc`) y una base MongoDB local o Atlas.

```bash
git clone https://github.com/ivan-gdiaz/supervillain-api-jwt.git
cd supervillain-api-jwt
npm ci
cp .env.example .env
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Edita `.env`: pon tu `MONGODB_URI` y copia la clave aleatoria generada en `TOKEN_SECRET`. No uses la contraseña de Atlas como clave JWT. Atlas debe autorizar tu IP y el usuario de base de datos debe tener `readWrite` sobre `villainlair`.

```bash
npm run seed         # opcional; conserva los datos si ya hay villanos
npm run start:local  # carga .env; API en http://localhost:3000
# npm run dev        # alternativa con recarga
```

`npm start` lee las variables del proceso, sin exigir un archivo `.env`: es el comando de Render. La API solo empieza a escuchar cuando MongoDB y el índice único de usuarios están disponibles. No se incluye ninguna cuenta precargada.

## Registro → login → petición autenticada

Ejemplos para Bash/zsh; son credenciales ficticias de práctica. También puedes usar las peticiones de [docs/peticiones.http](docs/peticiones.http) con REST Client o reproducirlas en Postman.

```bash
BASE=http://localhost:3000
curl -i -X POST "$BASE/api/users" \
  -H 'Content-Type: application/json' \
  -d '{"username":"alumno","password":"PracticaJWT_2026!","email":"alumno@example.test"}'
# 201; repetir el mismo username devuelve 409

curl -i -X POST "$BASE/api/users/signin" \
  -H 'Content-Type: application/json' \
  -d '{"username":"alumno","password":"PracticaJWT_2026!"}'
# 200 {"token":"...","tokenType":"Bearer","expiresIn":3600}

TOKEN='PEGA_AQUI_EL_VALOR_DE_token'
curl -i "$BASE/api/users/secure" -H "Authorization: Bearer $TOKEN"
# 200: solo el perfil del usuario autenticado, sin contraseña ni hash

curl -i -X POST "$BASE/api/villains" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Gru","alias":"El Ladrón de la Luna","evilLevel":8000}'
# 401: falta el token

curl -i -X POST "$BASE/api/villains" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Gru","alias":"El Ladrón de la Luna","evilLevel":8000}'
# 201: conserva data._id para las peticiones anidadas

curl -i "$BASE/api/villains"
# 200: excepción docente pendiente; tras el ejercicio debe ser 401
```

El JWT dura **una hora**. Incluye `sub` (id del usuario), `username`, `iat` y `exp`. `Bearer` pertenece a la cabecera HTTP, no al token. El payload es legible: la firma detecta alteraciones, no cifra el contenido. `TOKEN_SECRET` permanece en el servidor.

## Qué protege cada ruta

| Método y ruta | Acceso |
|---|---|
| `POST /api/users` | Público: registro |
| `POST /api/users/signin` | Público: credenciales → token |
| `GET /api/users/secure` | JWT: perfil propio |
| `GET /health` | Público: 200 con MongoDB disponible; 503 si no lo está |
| `GET /api/villains` | **Público como ejercicio pendiente** |
| `POST /api/villains` | JWT |
| `GET / PUT / DELETE /api/villains/:villainId` | JWT |
| `GET / POST /api/villains/:villainId/lairs` | JWT |
| `GET / PUT / DELETE .../lairs/:lairId` | JWT |
| `GET / POST .../lairs/:lairId/minions` | JWT |
| `GET / PUT / DELETE .../minions/:minionId` | JWT |
| `GET / POST .../lairs/:lairId/devices` | JWT |
| `GET / PUT / DELETE .../devices/:deviceId` | JWT |

En `routes/villains.js`, `tokenVerify` se ejecuta antes de `loadVillain` y antes del router de guaridas. Así protege toda la rama anidada, incluidos esbirros y máquinas. Las comprobaciones de pertenencia de recursos al padre siguen activas.

Campos de negocio: villano (`name`, `alias`, `evilLevel`); guarida (`name`, `location`); esbirro (`name`, `eyeCount`, `expendable`); máquina (`name`, `status`, `power`). `status`: `Inactiva`, `Cargando` o `Lista`. Los identificadores de padres salen de la URL.

## Correspondencia con moviesAppAuth

| Referencia | Adaptación |
|---|---|
| `models/User.js`, `pre('save')`, bcrypt y `comparePassword` | Mismo esquema; hook con promesas compatible con Mongoose 9 |
| `POST /users` | `POST /api/users` |
| `POST /users/signin` con dos handlers | `POST /api/users/signin` con comprobación y firma separadas |
| `jwt.sign(..., TOKEN_SECRET, {expiresIn: 3600})` | Misma clave y duración, `HS256` explícito e id en `sub` |
| Función `tokenVerify` dentro del router | `middleware/tokenVerify.js`, compartido por varios routers |
| `/users/secure` | `/api/users/secure`, limitado al perfil propio |
| Token devuelto en `message` | Campo explícito `token`, con `tokenType` y `expiresIn` |

Se corrigen la ausencia de cabecera Authorization, la exposición de hashes y los mensajes de login que revelaban si existía el usuario. Se validan tipos de entrada, se limita el algoritmo a HS256 y se exige caducidad. Username único y normalizado a minúsculas; contraseña de al menos 8 caracteres y máximo 72 bytes (límite bcrypt).

## Despliegue

El repositorio incluye [render.yaml](render.yaml), dependencias fijadas en `package-lock.json`, Node 24, variables y endpoint de salud. Sigue [la guía Render + Atlas](docs/DESPLIEGUE.md). No necesitas subir `.env` ni instalar MongoDB en Render.

## Pruebas

```bash
npm test                 # suite funcional y de seguridad; debe pasar
npm run test:exercise    # debe fallar hasta completar el TODO del listado
```

Las pruebas arrancan MongoDB temporal con `mongodb-memory-server`, sin usar Atlas ni `MONGODB_URI`. La primera ejecución descarga un binario de MongoDB y necesita Internet. Se cierran las instancias al finalizar. GitHub Actions ejecuta `npm test` en Node 24 con cada push y PR. Las pruebas del ejercicio están separadas para no marcar como error el estado docente inicial.

Se comprueban el CRUD anidado, hash y actualización de password, registro duplicado, validación de entradas, perfil, caducidad, firma manipulada, clave/algoritmo incorrectos, ausencia de cabecera y protección de todas las rutas de negocio previstas. Registro y login comparten un límite de 30 peticiones cada 15 minutos por IP (memoria de cada instancia; reiniciar restablece el contador).

## Estructura

- `models/User.js`: almacenamiento del usuario y hash bcrypt.
- `routes/users.js`: registro, signin y perfil autenticado.
- `config/auth.js`: validación del secreto y opciones JWT.
- `middleware/tokenVerify.js`: validación Bearer, firma y caducidad.
- `routes/villains.js`: aplicación de JWT y TODO para el alumnado.
- `app.js`: montaje de rutas, salud y errores en JSON.
- `bin/www`: conexión a MongoDB, índice único y arranque.
- `docs/`: guía de despliegue, ejercicio y peticiones reproducibles.

## Alcance docente

Esto implementa **autenticación**, sin roles ni propiedad de los recursos por usuario: cualquier usuario registrado puede operar sobre todos los villanos. El registro es abierto. Úsalo con datos de práctica; el ejercicio pendiente no debe confundirse con una protección completa.

No hay refresh tokens, lista de revocación ni logout en servidor: borrar el token en el cliente no invalida una copia; seguirá siendo válida hasta caducar. Rotar `TOKEN_SECRET` invalida los JWT anteriores. El middleware de negocio no comprueba en cada petición si la cuenta sigue existiendo. Usa HTTPS en Render y no pongas contraseñas ni datos privados en el payload. El borrado en cascada heredado no es transaccional.

Si una credencial del repositorio de origen sigue activa, rótala en Atlas: borrar el texto no elimina su historial público. Este repositorio no contiene esas credenciales.

## Referencias

- [Código base](https://github.com/ivan-gdiaz/supervillain-api-simplificada)
- [Patrón de autenticación de referencia](https://github.com/ivan-gdiaz/moviesAppAuth/tree/master)
- [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken)
- [bcryptjs](https://github.com/dcodeIO/bcrypt.js)
- [Blueprints de Render](https://render.com/docs/blueprint-spec)

Versiones de partida: supervillain-api-simplificada `860d5f8`; moviesAppAuth/master `4c2e3b0`.
