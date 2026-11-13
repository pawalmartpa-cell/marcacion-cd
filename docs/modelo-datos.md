# Modelo de datos (Cloud Firestore)

Todas las horas se guardan como `Timestamp` (UTC) y se muestran en hora de **El Salvador
(America/El_Salvador, UTC-6 sin horario de verano)**. Las fechas de calendario se guardan como texto
`yyyy-MM-dd` en hora de El Salvador. Las reglas que lo hacen cumplir están en
[`firestore.rules`](../firestore.rules) y sus pruebas en [`tests/rules`](../tests/rules).

## `users/{uid}`

| Campo | Tipo | Notas |
|---|---|---|
| `uid` | string | Igual al id del documento (Firebase Auth). |
| `nombre`, `apellidos` | string | 1–60 caracteres. **No se piden DUI ni otros datos personales.** |
| `email` | string | Igual al del token de Auth; no se puede cambiar. |
| `rol` | `'admin' \| 'pa' \| 'seguridad' \| 'kiosco'` | Al registrarse siempre `seguridad` (salvo invitación). |
| `cdId` | string | CD asignado (id de `cds`). |
| `estado` | `'pendiente' \| 'activo' \| 'bloqueado'` | Nueva cuenta = `pendiente`. |
| `proveedor` | `'google' \| 'correo'` | |
| `deviceId` | string \| null | Teléfono vinculado (se vincula solo la primera vez). |
| `deviceIdPendiente` | string \| null | Teléfono nuevo esperando aprobación del admin. |
| `firma` | map \| null | `{ tipo: 'dibujada'\|'generada', svg, fuente: 'Great Vibes'\|'Dancing Script'\|'Allura'\|null, actualizadaEn, cambioHabilitado }` |
| `consentimientoUbicacion` | `true` | Casilla obligatoria. |
| `creadoEn` | Timestamp | Hora del servidor. |

La firma se muestra **siempre dentro de `<img>`** (o como texto con la fuente), nunca insertando el
SVG en la página: así una firma manipulada no puede ejecutar código.

## `invitaciones/{email}`

Sin Cloud Functions un admin no puede crear cuentas de Auth. "Nuevo usuario" crea una invitación
`{ email, nombre, apellidos, rol, cdId, creadoPor, creadoEn }`. Cuando esa persona entra con ese
correo **verificado** (Google siempre lo está; con correo se verifica con el enlace que se envía),
su perfil se crea `activo` con ese rol y CD, y la invitación se borra en el mismo lote.

## `cds/{cdId}` (id = código, p. ej. `5184`)

| Campo | Tipo | Notas |
|---|---|---|
| `nombre`, `codigo` | string | |
| `ubicacion` | GeoPoint | Centro de la geocerca. |
| `radioValido` | number | Por defecto 150 m (20–1000). |
| `radioAlerta` | number | Por defecto 1000 m (> radioValido). |
| `turnos` | `[{ nombre, inicio: 'HH:mm', fin: 'HH:mm' }] × 3` | Diurno, Vespertino, Nocturno. `''` = aún sin definir (`[hh:mm]`). |
| `toleranciaMin` | int | Por defecto 10 (0–120). |
| `qrHabilitado` | bool | |
| `qrRotacionSeg` | 15 \| 30 \| 60 | |
| `paUids` | string[] | PA asignado. |
| `kioscoEmail` | string \| null | Reservado (la cuenta kiosco se identifica por su rol y CD). |

## `jornadas/{id}` — una jornada = entrada + salida de un turno

| Campo | Tipo | Notas |
|---|---|---|
| `uid`, `nombre`, `cdId` | string | `nombre` copiado del perfil al marcar (para listas y kiosco). |
| `fecha` | `yyyy-MM-dd` | **Fecha de la ENTRADA**, aunque la salida caiga al día siguiente. |
| `turno` | `{ nombre, inicio, fin }` | Copiado del CD al marcar (si luego cambia el horario, la jornada conserva el suyo). |
| `toleranciaMin` | int | Copiada del CD. |
| `entrada`, `salida` | Marca \| null | Ver abajo. |
| `estado` | `'abierta' \| 'cerrada'` | |
| `editada` | bool | `true` si un admin la creó o corrigió. |
| `ultimaEdicionId` | string \| null | Id del registro de `bitacora` de la última corrección. |
| `entradaOriginal`, `salidaOriginal` | Marca \| null | Marca original antes de la primera corrección. |
| `expiraEn` | Timestamp | Informativo (la limpieza la hace `purga.yml`, sin TTL de pago). |
| `creadoEn` | Timestamp | Hora del servidor. |

**Marca**: `{ horaServidor, horaDispositivo, metodo: 'gps'|'qr'|'admin', lat, lng, precision,
distanciaM, zona: 'valida'|'observacion'|'alerta', offline, deviceId, dispositivoDistinto, qrToken }`.

- `horaServidor` debe ser `request.time` (nunca la del celular).
- La zona se verifica en el servidor con `latlng.distance()` contra la ubicación del CD.
- Si `|horaServidor − horaDispositivo| > 5 min` la marca se muestra como **"Sin conexión ·
  sincronizada"**, vale la hora del teléfono y queda para revisión del PA.
- **Tardanza** y **estado** no se guardan: se calculan al mostrar (`src/lib/jornada.ts`), así nadie
  puede guardar un valor falso.
- Una jornada abierta deja de estar "En turno" a las 20 h y pasa a **"Sin salida"**.

## `alertas/{jornadaId}_{parte}`

`{ jornadaId, uid, nombre, cdId, parte: 'entrada'|'salida', tipo: 'fuera_rango'|'observacion'|
'sin_conexion'|'dispositivo'|'sin_salida', severidad: 'alta'|'media'|'info', texto, distanciaM,
estado: 'abierta'|'aceptada'|'rechazada', resueltoPor, resueltoNombre, comentario, creadoEn,
resueltoEn }`

- El guardia la crea en el **mismo lote** que su marca. Para zona `alerta` (> 1 km) la regla
  **exige** que exista (no se puede marcar lejos sin generar la alerta).
- `sin_salida` la crea la limpieza nocturna para jornadas abiertas de días anteriores.

## `kioscos/{cdId}`

`{ cdId, rotSeg, tokens: { TOKEN: { desde, hasta } }, actualizadoEn }` — lote de tokens de la
próxima hora, **una escritura por hora** (≈ 24 al día por kiosco). Los guardias no lo pueden leer:
la regla de `jornadas` valida el token con `get()` (± 1 ventana de gracia).

## `bitacora/{id}` (solo se agrega)

`{ quien, quienNombre, rol, accion, detalle, motivo, refTipo, refId, cdId, antes, despues, fecha }`.
Nadie la edita ni la borra desde la app. Toda corrección de jornada exige su registro en el mismo
lote (`getAfter`/`existsAfter` en las reglas) con motivo de 3+ caracteres.

## `notificaciones/{id}`

`{ para: 'staff'|'usuario', uid, cdId, tipo, texto, enlace, creadoPor, creadoEn, leidaPor[] }`.
`staff` = admins y PA del CD; `usuario` = un usuario concreto (solo admin/PA las crean).

## `solicitudes/{id}`

`{ uid, nombre, cdId, jornadaId|null, fecha, tipo: 'olvido_entrada'|'olvido_salida'|
'hora_incorrecta'|'otro', texto, estado: 'abierta'|'resuelta'|'rechazada', respuesta, creadoEn,
resueltoEn }`.

## `reportes/{id}`

Historial de reportes generados (solo parámetros; el archivo se vuelve a generar al descargar, sin
Cloud Storage): `{ nombre, tipo, formato, desde, hasta, cdId, uidGuardia, incluirFirma, filas, por,
porNombre, fecha }`.

## `config/general`

`{ diasRetencion: 30–180 (90), diasCambioFirma: 1–365 (30), nombreApp, tema: 'claro'|'oscuro'|'auto' }`.
Lectura pública (el nombre se muestra en el login); solo admin escribe.

## Índices

Están en [`firestore.indexes.json`](../firestore.indexes.json) y se despliegan solos. Todas las
consultas de la app viven en [`src/data/consultas.ts`](../src/data/consultas.ts).

## Permisos por rol (resumen)

| Colección | Seguridad | PA | Kiosco | Admin |
|---|---|---|---|---|
| users | lee/edita lo propio (nombre, firma con plazo, 1.er teléfono) | lee su CD | lee lo propio | todo menos borrarse |
| jornadas | crea las suyas; agrega salida 1 vez; lee las suyas | lee su CD | lee su CD | lee todo; crea/corrige **solo con bitácora** |
| alertas | crea con su marca | lee y resuelve su CD | — | todo |
| kioscos | — | lee/escribe su CD | lee/escribe su CD | todo |
| bitacora | — | agrega y lee su CD | — | agrega y lee todo |
| cds | lee | lee; activa/desactiva QR de su CD | lee | todo |
| config | lee | lee | lee | escribe |
