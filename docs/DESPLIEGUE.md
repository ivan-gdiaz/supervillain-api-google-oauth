# Google Cloud + Render + MongoDB Atlas

El repositorio contiene el flujo OAuth completo. Necesitas configurar un cliente de Google propio; sus credenciales no se publican en GitHub.

## 1. Crear el cliente en Google

1. Abre [Google Cloud Console](https://console.cloud.google.com/) y selecciona o crea un proyecto.
2. En **Google Auth Platform**, configura Branding (nombre de la app, correo de soporte y contacto) y Audience. Para cuentas personales o distintas organizaciones, utiliza External. Si mantienes Testing, añade las cuentas de prueba que usarán la práctica.
3. En Data Access comprueba los scopes básicos de identidad: `openid`, `email` y `profile`. No se solicita Gmail ni Drive.
4. En Clients, crea un cliente OAuth de tipo **Web application / Aplicación web**.
5. Añade las URI de redirección autorizadas que vayas a utilizar, exactamente:

```text
http://localhost:3000/api/auth/google/callback
https://TU-SERVICIO.onrender.com/api/auth/google/callback
```

La segunda es un marcador: sustituye el dominio por el que realmente asigne Render. No añadas barra final. No hace falta un origen JavaScript autorizado porque usamos redirección de servidor, sin SDK de Google en el navegador.

6. Guarda el Client ID y el Client secret en `.env` local y en Environment de Render. No compartas el secreto ni lo introduzcas en el frontend.

La API comprueba la identidad con OpenID Connect (OAuth 2.0, Authorization Code y PKCE). Nunca introduces la contraseña de Google en la API.

## 2. Preparar Atlas

Crea o reutiliza una base `villainlair` de prácticas. El usuario de base de datos necesita `readWrite` sobre ella. Autoriza tu IP local para trabajar en desarrollo y los rangos de salida del servicio Render para el despliegue.

Copia la URI desde Connect → Drivers, incluyendo `/villainlair` antes de `?`. Codifica los caracteres especiales de la contraseña de Atlas. Esta credencial de base de datos es independiente del cliente OAuth y de las cuentas que entran con Google.

Colecciones nuevas: `oauth_users` (perfiles) y `oauth_login_attempts` (intentos temporales con TTL). Las colecciones de negocio siguen siendo las mismas.

## 3. Configurar Render

Para un servicio nuevo: New → Blueprint, conecta GitHub y selecciona `ivan-gdiaz/supervillain-api-google-oauth`, rama `main`. Crea un servicio distinto si quieres conservar también desplegada la versión con contraseña. Revisa `render.yaml` e introduce las variables que solicite.

| Variable | Valor |
|---|---|
| `NODE_VERSION` | `24.x` |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | URI real de Atlas |
| `TOKEN_SECRET` | Clave JWT aleatoria; Blueprint la genera en un servicio nuevo |
| `GOOGLE_CLIENT_ID` | ID del cliente de Aplicación web |
| `GOOGLE_CLIENT_SECRET` | Secreto de ese mismo cliente |
| `GOOGLE_REDIRECT_URI` | Callback HTTPS exacto del servicio |

En un servicio o Blueprint ya existente, añade manualmente las tres variables `GOOGLE_*` en Environment antes del nuevo despliegue. Los secretos marcados `sync: false` no se actualizan automáticamente al sincronizar el YAML. El arranque falla si faltan estas variables o el callback no es válido.

Si aún desconoces el dominio asignado, crea/configura el servicio, consulta su URL y completa el callback tanto en Google como en Render antes de reintentar el despliegue.

Alternativa Web Service manual: Node, `npm ci --omit=dev` como build, `npm start` como inicio, `/health` como Health Check Path, rama `main`, Auto-Deploy On Commit. Render asigna `PORT`. El proceso escucha en `0.0.0.0` después de conectar a MongoDB e inicializar los índices. No subas un `.env`.

En Render → Connect → Outbound copia los rangos de salida y autorízalos en Atlas → Network Access. Espera a que estén activos.

## 4. Prueba real

1. Abre `https://TU-SERVICIO.onrender.com/health`: debe devolver 200.
2. Abre **en el navegador** `https://TU-SERVICIO.onrender.com/api/auth/google`.
3. Elige una cuenta permitida en Google y acepta el consentimiento.
4. El callback devolverá JSON con `token`, `tokenType`, `expiresIn` y `user`.
5. Copia `token` y prueba:

```bash
BASE=https://TU-SERVICIO.onrender.com
TOKEN='PEGA_EL_JWT_DE_LA_API'
curl -i "$BASE/api/users/secure" -H "Authorization: Bearer $TOKEN"
# 200
curl -i "$BASE/api/users/secure"
# 401
curl -i "$BASE/api/villains"
# 200 hasta que el alumnado complete el ejercicio
```

El token que admite la API es el que devuelve su callback, no un access token obtenido de otro servicio ni el ID token de Google. No pegues tokens activos en páginas públicas.

## 5. Cambio desde usuario/contraseña

`POST /api/users` y `POST /api/users/signin` devuelven 404. Cada usuario entra por Google y obtiene un perfil nuevo en `oauth_users`. No se vinculan cuentas por email. La antigua colección `users` se conserva sin usar; el despliegue no borra sus datos ni sus hashes. Los JWT antiguos se rechazan. No necesitas recrear villanos, guaridas, esbirros o máquinas.

`npm run seed` sigue siendo opcional y local; nunca se ejecuta en el build. La opción `--force` reemplaza los datos de negocio y debe usarse solo si deseas borrarlos.

## Problemas frecuentes

| Síntoma | Revisar |
|---|---|
| `redirect_uri_mismatch` en Google | Coincidencia exacta de protocolo, dominio, puerto y ruta en Google y `GOOGLE_REDIRECT_URI` |
| Google no permite a una cuenta entrar | Audience, usuarios de prueba, políticas de tu organización y estado de publicación |
| Fallo al arrancar | Variables `GOOGLE_*`, `TOKEN_SECRET`, URI e IP de Atlas |
| Callback 400 | Entrar primero por `/api/auth/google`, mismo navegador, cookie habilitada y menos de diez minutos; no recargar un callback ya usado |
| Callback 401 | Consentimiento denegado, código no válido o error al validar el ID token; inicia el flujo otra vez |
| Inicio 502 | Acceso a Google/discovery y configuración del cliente |
| Perfil o CRUD 401 | JWT propio completo, Bearer y caducidad; no usar el JWT antiguo |
| 429 | Límite de intentos OAuth; esperar 15 minutos |

La aplicación usa cookies Secure con HTTPS y HTTP solo para localhost en desarrollo. El servicio Free puede reactivarse con retraso. Un push a `main` despliega automáticamente; esta configuración no espera a GitHub Actions.

Fuentes: [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect), [configuración de consentimiento](https://developers.google.com/workspace/guides/configure-oauth-consent), [Render Blueprint](https://render.com/docs/blueprint-spec), [rangos de salida](https://render.com/docs/outbound-ip-addresses).
