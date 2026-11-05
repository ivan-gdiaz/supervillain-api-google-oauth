# Ejercicio: proteger el listado de villanos

## Situación inicial

La API tiene login con Google y un middleware `tokenVerify`. Las escrituras y las rutas anidadas ya requieren JWT. **`GET /api/villains` sigue abierto intencionadamente.** No es una recomendación de seguridad.

Objetivo: hacer que el listado también exija un JWT válido sin cambiar su URL ni el JSON de respuesta. Mantén públicos el inicio de Google, el callback y health.

## Trabajo del estudiante

1. Arranca la API y comprueba con una petición sin cabecera que el listado devuelve 200.
2. Localiza el comentario `TODO ALUMNADO` en `routes/villains.js`.
3. Estudia una ruta ya protegida. Identifica dónde se ejecuta el middleware, cuándo responde 401 y cuándo llama a `next()`.
4. Aplica el mismo mecanismo al listado. No copies el código de firma ni vuelvas a implementar `jwt.verify`.
5. Entra con Google desde el navegador y copia el JWT del callback. Prueba el listado con y sin token.
6. Ejecuta `npm test` y `npm run test:exercise`.
7. Haz commit y push a tu repositorio; espera el despliegue de Render y repite las comprobaciones en la URL pública.

## Resultados esperados tras completar el ejercicio

| Petición | Resultado |
|---|---|
| Listado sin Authorization | 401 |
| Listado con `Bearer incorrecto` | 401 |
| Listado con JWT caducado | 401 |
| Listado con JWT válido | 200 y JSON habitual |
| Inicio OAuth desde el navegador | Redirección a Google |
| Callback válido después de Google | 200 y JWT propio |
| `/health` con MongoDB disponible, sin token | 200 |

`npm run test:exercise` tiene cuatro pruebas: inicialmente fallan las tres de rechazo y pasa la de acceso válido. Después de la solución deben pasar las cuatro. `npm test` debe seguir pasando antes y después.

## Entrega

Entrega el cambio de código, la salida de ambas suites, la URL desplegada y las comprobaciones HTTP. Oculta los tokens y las credenciales en las capturas.

Explica: ¿qué comprueba el middleware?, ¿por qué el inicio OAuth y su callback deben seguir públicos?, ¿por qué un JWT firmado no demuestra que tengas permiso sobre un villano concreto?, ¿qué ocurre cuando expira el token?

Ampliación opcional: diseñar permisos por usuario y una respuesta 403 cuando alguien autenticado carece del permiso necesario. Esa autorización no está implementada en esta práctica.
