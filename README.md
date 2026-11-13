# Marcación CD

App web **PWA** (se instala en Android, iPhone y PC, y funciona sin conexión) para que los guardias
de seguridad de los Centros de Distribución marquen su entrada y salida, y para que los
coordinadores (PA) y los administradores lleven el control. Reemplaza la hoja de papel. **No calcula
sueldos ni horas extras**, solo registra la marcación.

- 👮 **Guardia**: marca con GPS (zonas de 150 m / 1 km) o con el QR del kiosco, turno nocturno en una
  sola jornada, modo sin conexión con contador, historial, calendario, firma y solicitudes.
- 🧑‍✈️ **PA**: panel en vivo de su CD, jornadas, alertas, reportes, firmas y QR.
- 🛠️ **Admin**: todo, más corrección de horas con bitácora, usuarios, CD con mapa y configuración.
- 📟 **Kiosco**: QR dinámico (1 escritura por hora) y lista de marcaciones de hoy.

**Costo: $0** (Firebase Spark sin tarjeta + GitHub Actions). Sin Cloud Functions ni Storage.

## Documentación

| Documento | Para qué |
|---|---|
| [docs/configuracion-firebase.md](docs/configuracion-firebase.md) | **Empieza aquí**: pasos desde el celular para crear Firebase, cargar secretos y crear el primer admin. |
| [docs/manual-uso.md](docs/manual-uso.md) | Manual corto por rol. |
| [docs/notificaciones-push.md](docs/notificaciones-push.md) | Avisos en el teléfono con la app cerrada (Cloudflare + FCM, gratis). |
| [docs/modelo-datos.md](docs/modelo-datos.md) | Colecciones, campos y permisos. |
| [docs/estimacion-costos.md](docs/estimacion-costos.md) | Lecturas, escrituras y borrados frente al plan gratis. |
| [docs/prototipo-admin.html](docs/prototipo-admin.html) | Prototipo de referencia del panel. |

## Tecnología

React 18 + Vite + TypeScript estricto + Tailwind · `vite-plugin-pwa` · Firebase Auth (Google y
correo) · Cloud Firestore con caché persistente sin conexión · Leaflet + OpenStreetMap · `qrcode` +
`@zxing/browser` · `signature_pad` · `exceljs` + `jspdf` · `date-fns-tz` (America/El_Salvador) ·
`react-hook-form` + `zod` · Vitest + Testing Library + `@firebase/rules-unit-testing` · Playwright +
axe.

## Seguridad

La protección real está en [`firestore.rules`](firestore.rules), no en la interfaz:
- La hora de cada marca es la del **servidor** (`request.time`).
- Un guardia solo marca para sí mismo, en su CD y con su cuenta activa; agrega la salida una sola
  vez y no puede tocar la entrada.
- La zona declarada se verifica en el servidor con `latlng.distance()`; marcar a más de 1 km obliga
  a crear la alerta.
- El QR se valida contra el lote de tokens del kiosco (que los guardias no pueden leer).
- Toda corrección del admin va en un lote con su registro de bitácora y motivo (`getAfter`).
- La bitácora solo se agrega; nadie la edita ni la borra.

## Flujo de trabajo (GitHub Actions)

| Workflow | Cuándo | Qué hace |
|---|---|---|
| `ci.yml` | Cada PR | Lint, pruebas unitarias, pruebas de reglas en el emulador, build, E2E y accesibilidad. |
| `deploy.yml` | Push a `main` | Despliega Hosting, `firestore.rules` y `firestore.indexes.json`. |
| `make-admin.yml` | Manual | Da rol Admin a un correo (y opcionalmente crea los CD del prototipo). |
| `avisos.yml` | Cambios en `worker/` + manual | Despliega el Worker de Cloudflare que envía las notificaciones push. |
| `purga.yml` | 23:00 diario + manual | Borra lo vencido según la retención (lotes de 400, máx. 19 000/día) y crea alertas de salida sin marcar. |

## Desarrollo (opcional, en Claude Code o una PC)

```bash
npm ci
npm run lint        # ESLint
npm test            # Vitest (lógica y componentes)
npm run test:rules  # Reglas de Firestore en el emulador (requiere Java)
npm run build       # Build de producción
npm run e2e         # Playwright contra los emuladores (siembra datos de ejemplo)

# Probar la app con datos de ejemplo:
npm run emulators            # en una terminal
npm run seed                 # en otra (cuentas *@test.com, contraseña 12345678)
VITE_USE_EMULATOR=true npm run dev
```

## Pendiente de definir (valores editables, no inventados)

- Horarios de los turnos de cada CD: el admin los escribe en **Centros de distribución**
  (mientras tanto se muestran como `[hh:mm]` y no se calcula tardanza).
- Tolerancia de llegada tarde: 10 min por defecto, editable por CD.
- Columnas de la hoja de papel: se usa `Fecha, Guardia, CD, Turno, Entrada, Salida, Firma`. Para
  cambiar el orden se edita `COLUMNAS_HOJA` en [`src/lib/reportes.ts`](src/lib/reportes.ts).
