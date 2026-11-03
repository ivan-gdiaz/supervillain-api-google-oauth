# Despliegue en Render con MongoDB Atlas

Se entrega el código de despliegue. Para crear un servicio real debes entrar en tus cuentas de Render y Atlas y aportar tu URI; no hay credenciales reales en el repositorio.

## 1. Preparar Atlas

1. Crea o reutiliza un clúster de prácticas. Crea un usuario de base de datos con `readWrite` sobre `villainlair`.
2. En Connect → Drivers copia la URI e incluye `/villainlair` antes de `?`. Codifica caracteres especiales de la contraseña (por ejemplo, `@` → `%40`).
3. Autoriza tu IP local para las pruebas. Para Render, añade sus rangos de salida al terminar el paso siguiente.
4. El usuario de Atlas permite a la API conectarse a MongoDB. Los usuarios creados en `/api/users` son cuentas distintas, almacenadas en la colección `users`.

## 2. Crear un Blueprint de Render

1. Abre el panel de Render → New → Blueprint y conecta tu cuenta de GitHub.
2. Selecciona `ivan-gdiaz/supervillain-api-jwt`, rama `main`.
3. Revisa el servicio y el plan Free definidos en `render.yaml`.
4. Introduce `MONGODB_URI` cuando lo solicite. Render generará `TOKEN_SECRET` mediante `generateValue: true`.
5. Crea el Blueprint. En el servicio, Connect → Outbound, copia los rangos de salida y añádelos en Atlas → Network Access. Espera a que estén activos y reintenta el despliegue si había fallado.

No publiques ni copies la clave JWT en el código o en peticiones del cliente. Si configuras el servicio manualmente, genera una clave aleatoria de al menos 32 bytes:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

## Alternativa: Web Service manual

Conecta GitHub mediante Git Provider para los despliegues automáticos, selecciona el repositorio y configura:

| Campo | Valor |
|---|---|
| Runtime | Node |
| Branch | main |
| Root Directory | Vacío |
| Build Command | `npm ci --omit=dev` |
| Start Command | `npm start` |
| Health Check Path | `/health` |
| Auto-Deploy | On Commit |
| NODE_VERSION | `24.x` |
| NODE_ENV | `production` |
| MONGODB_URI | Tu URI de Atlas |
| TOKEN_SECRET | Clave aleatoria; mínimo 32 bytes |

Render asigna `PORT` y termina HTTPS. El proceso escucha en `0.0.0.0`. `npm start` no carga `.env`; las variables se toman de Environment. `RENDER=true`, proporcionada por Render, activa la confianza en un salto de proxy para el limitador de peticiones.

## 3. Verificar la URL publicada

Cambia `BASE` por la URL que realmente te asigne Render (el nombre puede variar):

```bash
BASE=https://TU-SERVICIO.onrender.com
curl -i "$BASE/health"                 # 200 y {"status":"ok"}
curl -i "$BASE/api/users/secure"       # 401 sin JWT
curl -i -X POST "$BASE/api/villains"    # 401 sin JWT
curl -i "$BASE/api/villains"           # 200: ejercicio aún pendiente
```

Después reproduce registro → signin → petición con Bearer del README contra esta misma BASE. Comprueba que el token recibido no sea una cadena vacía y que la creación autenticada de villano devuelve 201.

El endpoint `/health` no exige token y pasa a 503 cuando MongoDB no está disponible. Si el arranque falla antes de escuchar, consulta los logs; revisa URI, permisos, IP y `TOKEN_SECRET`. No uses un endpoint protegido como comprobación de salud.

## 4. Actualizaciones y datos

Un push a `main` provoca otro despliegue. `autoDeployTrigger: commit` no espera a GitHub Actions: revisa el resultado de las pruebas; puedes cambiar en Render a despliegue tras checks si tu configuración lo permite. La versión publicada se comprueba en Deploys. Los datos persisten en Atlas.

La carga opcional `npm run seed` se ejecuta desde tu ordenador, con `.env` configurado y tu IP autorizada. **No se ejecuta durante el build.** `--force` elimina y repuebla los datos de negocio: no lo uses para conservarlos. No crea ni elimina usuarios.

## 5. Fallos habituales

| Síntoma | Comprobación |
|---|---|
| Fallo por TOKEN_SECRET | Falta la clave, es demasiado corta o contiene un marcador |
| No conecta con MongoDB | URI, usuario, contraseña codificada y rangos de salida |
| 401 en una ruta protegida | `Authorization: Bearer TOKEN`, firma y caducidad |
| 409 al registrar | Username ya existe, también ignorando mayúsculas |
| 429 al entrar o registrarse | Límite compartido de 30 peticiones/15 min/IP |
| Health no pasa | Ruta `/health`, conexión a Atlas y logs de arranque |
| Primera petición lenta | El servicio Free puede estar reactivándose |
| Tras rotar la clave falla un token | Vuelve a hacer signin; los tokens previos ya no valen |

Documentación: [Express en Render](https://render.com/docs/deploy-node-express-app), [Blueprint YAML](https://render.com/docs/blueprint-spec), [IP de salida](https://render.com/docs/outbound-ip-addresses), [acceso de red de Atlas](https://www.mongodb.com/docs/atlas/security/ip-access-list/).
