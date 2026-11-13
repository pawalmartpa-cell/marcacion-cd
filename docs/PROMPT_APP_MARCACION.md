# Prompt para Claude Code — App de Marcación de Seguridad (CD Walmart)

> **Cómo usarlo**
> 1. Crea un repositorio vacío en GitHub (ej. `marcacion-cd`) y ábrelo en Claude Code (web o app del celular).
> 2. Sube a la carpeta `docs/` el archivo del prototipo del panel admin con el nombre `docs/prototipo-admin.html`.
> 3. Pega todo lo que está debajo de la línea y deja que Claude Code trabaje fase por fase.

---

## ROL Y FORMA DE TRABAJO

Eres un ingeniero senior full-stack (React + Firebase) y diseñador de producto. Vas a construir
desde cero una app web **PWA** para que los guardias de seguridad de los Centros de Distribución
(CD) de Walmart El Salvador marquen su entrada y salida, y para que los coordinadores (PA) y los
administradores lleven el control. Reemplaza la hoja de papel que luego se pasa a Excel. **No
calcula sueldos ni horas extras**: solo registra la marcación.

Reglas de trabajo:
1. Lee primero `docs/prototipo-admin.html`. Es la **referencia visual y de UX obligatoria** del
   panel admin: navegación, pantallas, textos, colores y la vista de jornadas. Respóndeme con un
   plan corto por fase y luego ejecuta sin esperar más confirmación, salvo que algo sea ambiguo,
   destructivo o tenga costo.
2. Trabaja en ramas por fase (`fase-1-auth`, etc.), con commits pequeños en español y un PR por
   fase con un resumen de lo hecho y de cómo probarlo.
3. Al cerrar cada fase deben pasar `npm run lint`, `npm run test`, las pruebas de reglas de
   Firestore en el emulador y `npm run build`.
4. **Yo no tengo PC.** Todo debe poder desarrollarse desde Claude Code y desplegarse con
   **GitHub Actions**. Nada de pasos que requieran instalar algo en una computadora. Si yo tengo
   que hacer algo en la consola de Firebase o en GitHub, dame los pasos numerados y pensados para
   hacerlos desde el navegador del celular.
5. **Costo $0**: plan gratuito Spark de Firebase, **sin tarjeta**. Prohibido usar Cloud Functions,
   Cloud Storage, políticas TTL de Firestore o cualquier servicio que exija el plan Blaze. No se
   guardan fotos, solo texto.
6. Nunca subas secretos al repositorio. La configuración pública de Firebase va en variables
   `VITE_FIREBASE_*` (archivo `.env.example` + secretos de GitHub). La cuenta de servicio va solo
   en el secreto `FIREBASE_SERVICE_ACCOUNT`.

---

## STACK

| Área | Tecnología |
|---|---|
| Frontend | React 18 + Vite + TypeScript (strict) + Tailwind CSS + React Router |
| PWA | `vite-plugin-pwa` (instalable en Android/iPhone/PC, funciona sin conexión) |
| Autenticación | Firebase Auth: Google y correo/contraseña |
| Base de datos | Cloud Firestore con persistencia offline (`persistentLocalCache`) |
| Hosting | Firebase Hosting, desplegado con GitHub Actions |
| Mapas | Leaflet + OpenStreetMap (gratis, sin API key) |
| QR | `qrcode` (generar en el kiosco) + `@zxing/browser` o `html5-qrcode` (escanear) |
| Firma | `signature_pad` (dibujada) + fuentes cursivas de Google Fonts (generada) |
| Reportes | `exceljs` (Excel con estilo) + `jspdf` + `jspdf-autotable` (PDF) |
| Fechas | `date-fns` + `date-fns-tz`, zona fija `America/El_Salvador` |
| Formularios | `react-hook-form` + `zod` |
| Pruebas | Vitest + Testing Library + `@firebase/rules-unit-testing` con el emulador |
| Tareas programadas | GitHub Actions (cron) + `firebase-admin` |

---

## ROLES

| Rol | Qué puede hacer |
|---|---|
| **Admin** | Todo. Puede haber varios, todos con el mismo nivel. Puede nombrar a otros admins. |
| **PA** (coordinador de guardias) | Ve **solo su CD**: panel en vivo, jornadas, alertas (aceptar/rechazar), reportes, firmas (solo lectura), kiosco QR de su CD. **No edita** horas de marcación ni usuarios. |
| **Seguridad** (guardia) | Marca entrada/salida, elige su turno, ve su historial y su dashboard, crea su firma, solicita correcciones. |
| **Kiosco QR** | Cuenta de un teléfono fijo en la garita. Solo muestra el QR dinámico de su CD y la lista de quién marcó hoy. |

---

## REGISTRO E INICIO DE SESIÓN

- **Con Google:** después del primer inicio aparece una pantalla de "Completa tu perfil" con
  **nombre, apellidos, CD** (lista que administra el admin; ej. Hortifruti 5184, Apopa 7417,
  San Juan Opico 7018) y la **firma**.
- **Con correo:** el registro pide correo, contraseña, nombre, apellidos, CD y firma en un solo
  flujo. Incluye recuperación de contraseña.
- **No se piden** DUI ni otros datos personales.
- Toda cuenta nueva queda en estado **Pendiente** y ve una pantalla de "Esperando aprobación"
  hasta que un admin la apruebe. Solo los admins asignan roles distintos de Seguridad.
- Usuario **Bloqueado**: no puede entrar ni marcar.
- **Primer admin:** crea un workflow de GitHub Actions `make-admin.yml` (ejecución manual con el
  correo como parámetro) que use `firebase-admin` para darle rol Admin y estado Activo a ese
  usuario. Así no necesito PC.
- Casilla obligatoria de consentimiento para el uso de la ubicación al marcar.

---

## MODELO DE DATOS (Firestore)

Diséñalo y documéntalo en `docs/modelo-datos.md`. Mínimo:

- `users/{uid}`: nombre, apellidos, email, rol, cdId, estado (`pendiente|activo|bloqueado`),
  proveedor, deviceId, firma `{tipo: 'dibujada'|'generada', svg, fuente?, actualizadaEn,
  cambioHabilitado}`, creadoEn.
- `cds/{cdId}`: nombre, código, ubicación (`GeoPoint`), radioValido (150 m), radioAlerta (1000 m),
  turnos `[{nombre: 'Diurno'|'Vespertino'|'Nocturno', inicio: 'HH:mm', fin: 'HH:mm'}]`,
  toleranciaMin, qrHabilitado, qrRotacionSeg, paUids.
- `jornadas/{id}`: **una jornada = entrada + salida de un turno** (es como se muestra en el
  prototipo). Campos: uid, cdId, fecha (de la ENTRADA, aunque la salida caiga al día siguiente),
  turno + rango copiado del CD, `entrada` y `salida` (cada una con horaServidor, horaDispositivo,
  método `gps|qr`, lat/lng, precisión, distanciaM, zona `valida|observacion|alerta`, offline,
  deviceId), estado, editada, expiraEn.
- `alertas/{id}`: jornadaId, parte (`entrada|salida`), tipo, severidad, estado
  (`abierta|aceptada|rechazada`), resueltoPor, comentario.
- `kioscos/{cdId}`: tokens del QR (ver la sección del kiosco).
- `bitacora/{id}`: quién, rol, acción, antes/después, motivo, fecha. Solo se agrega, nunca se
  edita ni se borra desde la app.
- `notificaciones/{id}`: aviso interno (cambio de firma, registro pendiente, alerta nueva).
- `config/general`: diasRetencion (por defecto 90), diasCambioFirma (30), nombreApp, tema.
- `solicitudes/{id}`: corrección pedida por un guardia (olvidó marcar, etc.).

---

## REGLAS DE SEGURIDAD (lo más importante)

Escribe `firestore.rules` con pruebas en el emulador para cada regla:
- Los roles se validan en las reglas con `get(/users/$(request.auth.uid))`, no solo en la interfaz.
- **PA**: lectura limitada a documentos donde `cdId` es su CD.
- **Seguridad**:
  - Solo crea jornadas propias, para su CD y con estado Activo.
  - `entrada.horaServidor == request.time` (hora del servidor, nunca la del celular).
  - Solo puede agregar la salida una vez, y nunca modificar la entrada.
  - No puede leer las jornadas de otros.
- **Edición por admin**: solo en un `batch` que cree también su registro en `bitacora`. Valídalo
  con `getAfter`/`existsAfter`, con el motivo obligatorio.
- **Firma**: el guardia solo puede cambiarla si pasaron `diasCambioFirma` desde `actualizadaEn` o
  si `cambioHabilitado == true`. Al cambiarla, `cambioHabilitado` vuelve a `false`.
- `kioscos/*`: solo lo leen y escriben el Kiosco de ese CD y los admins/PA. Los guardias **no**
  pueden leerlo (la validación del QR se hace con `get()` dentro de las reglas).
- Nadie puede leer ni escribir `bitacora` excepto para agregar; solo admin y PA leen.
- Usa el tipo `latlng` de las reglas (`.distance()`) para verificar, del lado del servidor, que la
  zona declarada coincide con la distancia.

---

## MARCACIÓN (App Seguridad)

**Método principal: GPS**
1. El guardia elige su turno (Diurno, Vespertino o Nocturno). El rango de horas sale del CD.
2. Botón grande **"Marcar entrada"** o **"Marcar salida"**, según su jornada abierta.
3. Se toma la ubicación con alta precisión. Si la precisión es peor que 100 m, se reintenta y se
   avisa.
4. Zonas según la distancia al CD:
   - **≤ 150 m:** válida.
   - **150 m – 1 km:** se acepta, con estado Observación.
   - **> 1 km:** se acepta, pero crea una **alerta** para PA y admin.
5. Una jornada abierta (con entrada y sin salida) pertenece a la fecha de la entrada, aunque la
   salida sea después de medianoche (turno nocturno).
6. **Tardanza:** si la entrada pasa del inicio del turno más la tolerancia, la jornada se marca.
7. **Dispositivo vinculado:** se guarda un `deviceId` local. Si marca desde otro dispositivo, la
   marca queda con observación y el admin puede aprobar el cambio de dispositivo.

**Método secundario: QR del kiosco** (cuando el CD lo tiene habilitado)
- El guardia escanea el QR de la garita con la cámara desde la app y la marca se guarda con
  método `qr`.

**Modo sin conexión**
- Si no hay internet, la marca se guarda en el teléfono (persistencia offline de Firestore) con la
  hora y la ubicación del dispositivo, y se envía al reconectar. Debe verse un indicador claro de
  "Sin conexión · se enviará al reconectar" y un contador de marcas pendientes.
- Al sincronizar, si la hora del servidor y la del dispositivo difieren más de 5 minutos, la
  marca queda con estado "Sin conexión" para que PA la revise.
- El QR no funciona sin conexión: en ese caso solo se marca con GPS (o en la hoja de papel de
  respaldo).

**Otras pantallas del guardia**
- Dashboard personal: estado de hoy, jornadas de la semana, calendario del mes (a tiempo,
  observación, tardanza, libre) e historial según la retención.
- **Firma:** dos opciones, **dibujar** con el dedo o **generar** a partir de su nombre en 3 estilos
  de letra cursiva. Se guarda como SVG. Muestra cuándo podrá volver a cambiarla. Al cambiarla se
  notifica a PA y admin.
- Solicitar corrección: elige la jornada, escribe qué pasó, y la solicitud llega al admin.

---

## KIOSCO QR (sin costo extra)

Para no gastar escrituras rotando el código cada pocos segundos:
- Cada hora, el kiosco genera un **lote de tokens aleatorios** para las ventanas de la siguiente
  hora (según `qrRotacionSeg`, por defecto 30 s) y lo guarda en **una sola escritura** en
  `kioscos/{cdId}` como un mapa `token → {desde, hasta}`. Son unas 24 escrituras al día por kiosco.
- La pantalla muestra el token de la ventana actual en un QR grande, con una barra de cuenta
  regresiva, el nombre del CD, la hora y la lista de marcaciones de hoy.
- La regla valida que el token de la marca exista en ese mapa y que `request.time` caiga dentro de
  su ventana (± 1 ventana de gracia).
- Modo pantalla completa, pantalla siempre encendida (Wake Lock API cuando esté disponible) y
  aviso si se pierde la conexión.

---

## PANEL ADMIN (seguir `docs/prototipo-admin.html`)

Mismas secciones y comportamiento que el prototipo, con datos reales:
1. **Resumen:** guardias en turno, marcaciones de hoy, registros por aprobar, alertas abiertas,
   ocupación por CD y jornadas de hoy. Filtro por CD arriba en todas las secciones.
2. **Registros de asistencia (vista por jornada):** una fila por guardia y día, con **entrada y
   salida en la misma fila**, horas, estado y un punto de color por zona. Se agrupa por día
   (Hoy / Ayer / Esta semana / rango) y tiene búsqueda y el filtro "Solo con pendientes".
   **Al tocar una hora** se abre un solo diálogo con entrada y salida lado a lado, la hora
   original, las horas recalculadas, el motivo obligatorio y botones de motivo rápido. Si falta
   la salida aparece "+ Agregar". Al guardar se escribe la bitácora y se cierran las alertas de esa
   jornada.
3. **Detalle del guardia:** perfil, firma, calendario del mes, jornadas y acciones (bloquear,
   editar, habilitar cambio de firma).
4. **Usuarios:** pestañas Pendientes, Activos y Bloqueados; aprobar, rechazar, crear, editar (rol y
   CD), bloquear, desbloquear y eliminar con confirmación.
5. **Centros de distribución:** lista y detalle con mapa Leaflet (mover el punto, radio ajustable,
   círculos de 150 m y 1 km), horarios de los 3 turnos, tolerancia, PA asignado y sus guardias.
   Formulario para agregar un CD con el botón "Usar mi ubicación actual".
6. **Alertas:** lista y detalle con el mapa mostrando dónde marcó respecto al CD; aceptar, rechazar
   (con comentario) o "Corregir esta jornada".
7. **Reportes:** por guardia, por CD, tardanzas y salidas sin marcar, alertas y bitácora; rango de
   fechas; Excel o PDF con la firma de cada guardia. El orden de columnas debe ser igual a la hoja
   de papel. Historial de reportes generados.
8. **Kiosco QR:** activar o desactivar por CD, rotación de 15/30/60 s y cuenta kiosco asignada.
9. **Firmas:** vista de solo lectura y botón "Habilitar cambio ahora" (notifica al guardia).
10. **Bitácora:** cronológica, con filtros por usuario, acción y fecha.
11. **Configuración:** días de retención (30–180), tema (claro / oscuro / automático), nombre de la
    app, días para volver a cambiar la firma, administradores (agregar con el mismo nivel) y uso
    estimado del plan gratuito.
12. **Mi perfil** y cerrar sesión.

## PANEL PA

Igual al panel admin, pero limitado a su CD y sin: editar horas, gestionar usuarios, CD,
configuración ni administradores. Puede aceptar o rechazar alertas con comentario, descargar
reportes, ver firmas y activar o desactivar el QR de su CD.

---

## RETENCIÓN Y LIMPIEZA AUTOMÁTICA (gratis)

- Workflow de GitHub Actions `purga.yml` con `cron` diario (23:00 hora de El Salvador =
  05:00 UTC) y ejecución manual. Debe:
  - Leer `config/general.diasRetencion`.
  - Borrar por completo las jornadas, alertas, notificaciones y solicitudes más antiguas, en lotes
    de 400.
  - Respetar el límite gratuito de 20,000 borrados al día.
  - Escribir un resumen en la bitácora.
- Usa `firebase-admin` con el secreto `FIREBASE_SERVICE_ACCOUNT`.

---

## DISEÑO

- **Colores Walmart:** azul `#0071CE` (principal), amarillo `#FFC220` (acento), azul marino
  `#041E42` (menú y modo oscuro). No uses el logo oficial de Walmart.
- Tipografía Inter, con números tabulares para horas. Para la firma generada: Great Vibes,
  Dancing Script y Allura.
- Responsiva: la app del guardia está pensada para celular (una mano, botones de 44 px o más); los
  paneles de PA y admin, para computadora y celular (el menú lateral se vuelve un menú ☰).
- Modo oscuro completo, contraste AA, accesible (etiquetas, foco visible, `aria-*`).
- Estados vacíos, de carga y de error en todas las pantallas. Avisos (toasts) en lugar de `alert`.
- Todo en español de El Salvador, formato de 24 h y fechas dd/mm/aaaa.

---

## DESPLIEGUE (GitHub Actions)

- `ci.yml`: lint + pruebas + pruebas de reglas en el emulador + build en cada PR.
- `deploy.yml`: en cada push a `main`, despliega Hosting y `firestore.rules` /
  `firestore.indexes.json` con `firebase-tools`.
- `make-admin.yml` y `purga.yml`, como se describió arriba.
- Documenta en `docs/configuracion-firebase.md` los pasos que yo debo hacer **desde el celular**:
  1. Crear el proyecto en Firebase (plan Spark).
  2. Activar Auth con Google y con correo.
  3. Crear Firestore.
  4. Registrar la app web y copiar la configuración.
  5. Generar la cuenta de servicio.
  6. Cargar los secretos en GitHub.
  7. Ejecutar `make-admin`.

---

## FASES (un PR por fase)

0. **Base:** proyecto Vite + TS + Tailwind + PWA, estructura de carpetas, ESLint/Prettier, Vitest,
   emulador de Firebase en CI, workflows `ci` y `deploy`, tema y componentes base (botón, tarjeta,
   tabla, chip, diálogo, toast) con los colores de Walmart.
1. **Auth y roles:** login con Google y correo, registro, "Completa tu perfil", estado pendiente,
   bloqueo, rutas protegidas por rol y workflow `make-admin`.
2. **Datos y reglas:** modelo, `firestore.rules`, índices y pruebas completas de reglas. Incluye
   datos semilla de ejemplo (los del prototipo) solo para el emulador.
3. **App Seguridad:** marcar con GPS por zonas, turnos, turno nocturno, modo offline con cola,
   dashboard, historial, firma y solicitudes.
4. **Kiosco QR:** generación por lotes, pantalla del kiosco, escaneo desde la app y validación en
   las reglas.
5. **Panel Admin** completo según el prototipo.
6. **Panel PA.**
7. **Reportes Excel/PDF, alertas, notificaciones internas y bitácora con filtros.**
8. **Configuración, retención y `purga.yml`;** pulido de la PWA (íconos, pantalla de inicio,
   actualización de versión).
9. **QA final:** pruebas end-to-end de los flujos principales, revisión de accesibilidad, README
   y manual corto de uso por rol.

**Criterios de aceptación clave**
- Un guardia no puede marcar con hora falsa, por otro usuario, ni para otro CD (lo prueban las
  reglas).
- Una entrada a las 22:00 con salida a las 06:00 del día siguiente queda en **una sola jornada**.
- Una marca sin conexión se sincroniza sola y queda identificada.
- Toda corrección del admin queda en la bitácora con motivo; PA no puede corregir horas.
- Con 25 usuarios marcando 2–4 veces al día, el uso queda muy por debajo de los límites gratis
  (documenta la estimación de lecturas, escrituras y borrados).

---

## LO QUE AÚN FALTA DEFINIR (deja valores editables, no los inventes)

- Horarios exactos de los turnos Diurno, Vespertino y Nocturno de cada CD: el admin los configura;
  deja `[hh:mm]` como placeholder en los datos semilla.
- Tolerancia de llegada tarde (por defecto 10 min, editable).
- Columnas exactas de la hoja de papel para el reporte (usa Fecha, Guardia, CD, Turno, Entrada,
  Salida, Firma hasta que te pase la hoja).
