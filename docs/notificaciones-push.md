# Notificaciones push (llegan aunque la app esté cerrada)

**Costo: $0.** Firebase Cloud Messaging (FCM) es gratis y sin límite. El Worker de Cloudflare
envía hasta 100 000 avisos al día gratis, **sin tarjeta**. Con 25 guardias se usan unos 50–100 al
día.

## Cómo funciona

1. Cada persona toca **🔔 → "Activar avisos en este teléfono" → Permitir**. El teléfono queda
   registrado en `tokensPush`.
2. Cuando se crea un aviso (por ejemplo, una alerta de marcación), la app le pide al Worker que lo
   envíe. El Worker verifica que quien pide sea un usuario real de la app.
3. El Worker calcula los destinatarios con las mismas reglas de la campana:

   | Aviso | Admin | PA de ese CD | Guardia |
   |---|---|---|---|
   | Alerta de marcación | ✅ | ✅ | — |
   | Cambio de firma | ✅ | ✅ | — |
   | Registro por aprobar | ✅ | — | — |
   | Solicitud de corrección | ✅ | — | — |
   | Respuesta / firma habilitada | — | — | ✅ (solo esa persona) |

4. FCM entrega la notificación al teléfono, con la app abierta o cerrada. Al tocarla se abre la
   pantalla del aviso.
5. Respaldo: cada minuto el Worker revisa si quedó algún aviso sin enviar. Eso cubre las marcas
   hechas sin internet que se sincronizan después y los avisos de la limpieza nocturna. Nunca envía
   el mismo aviso dos veces.

## Configuración (una sola vez, desde el celular, unos 15 minutos)

> En Chrome activa **⋮ → "Sitio de escritorio"** si alguna pantalla de Cloudflare se ve cortada.

### 1. Crear la cuenta gratis de Cloudflare
1. Abre <https://dash.cloudflare.com/sign-up>, escribe tu correo y una contraseña y toca
   **Sign up**.
2. Abre el correo de verificación de Cloudflare y toca el enlace.
3. Si te ofrece agregar un dominio o elegir plan, **omítelo**. No hace falta y no pide tarjeta.

### 2. Activar Workers y tu subdominio
1. En el menú de la izquierda (☰) toca **Workers & Pages** (puede estar dentro de "Compute").
2. Si te pide **elegir un subdominio** `*.workers.dev`, escribe por ejemplo `marcacion-cd` y
   confirma. Si ya aparece uno, déjalo.
3. En esa misma pantalla, a la derecha o abajo, busca **Account ID** (una cadena de 32 letras y
   números). Cópialo.

### 3. Crear el token para GitHub
1. Toca el ícono de tu perfil (arriba a la derecha) → **My Profile** → **API Tokens**.
2. Toca **Create Token**.
3. En la plantilla **"Edit Cloudflare Workers"**, toca **Use template**.
4. En **Account Resources** deja *Include → tu cuenta*. En **Zone Resources** deja *All zones*.
5. Toca **Continue to summary** → **Create Token**.
6. **Copia el token.** Solo se muestra una vez.

### 4. Cargar los 2 secretos en GitHub
GitHub (en Chrome) → tu repositorio → **Settings → Secrets and variables → Actions → New
repository secret**:
- `CLOUDFLARE_API_TOKEN` → el token del paso 3.
- `CLOUDFLARE_ACCOUNT_ID` → el Account ID del paso 2.

### 5. Revisar que FCM esté activo en Firebase
Firebase → ⚙ **Configuración del proyecto** → pestaña **Cloud Messaging**. En
**"API de Firebase Cloud Messaging (V1)"** debe decir **Habilitada**. Si dice inhabilitada, toca
⋮ → *Administrar API en Google Cloud Console* → **Habilitar**.

### 6. Desplegar el Worker
GitHub → **Actions → avisos → Run workflow → Run workflow**. Espera el ✅ (unos 2 minutos). Al
final se ve "✅ Avisos push activos en https://marcacion-avisos.TU-SUBDOMINIO.workers.dev".

### 7. Activar los avisos en cada teléfono
En la app: **🔔 → "Activar avisos en este teléfono" → Permitir**. Debe aparecer "✓ Avisos activados
en este teléfono, aunque la app esté cerrada". Lo hace cada admin y cada PA en su teléfono, y los
guardias si quieren recibir las respuestas a sus solicitudes.

## Si no llegan

| Síntoma | Solución |
|---|---|
| El workflow *avisos* dice "Faltan secretos" | Revisa el paso 4 (nombres exactos). |
| "No se obtuvo la dirección del Worker" | Haz el paso 2 (subdominio workers.dev) y vuelve a ejecutar. |
| Error de autenticación de Cloudflare | Crea otra vez el token con la plantilla "Edit Cloudflare Workers". |
| No sale el botón "Activar avisos" | Actualiza la app (aviso "Hay una nueva versión"). En iPhone, primero instálala con "Agregar a inicio" (iOS 16.4 o más reciente). |
| Activado pero no llegan | Android → Ajustes → Apps → Chrome → Notificaciones: permitidas. Desactiva el ahorro de batería para Chrome. |
| Llegan a un teléfono que ya no usa la cuenta | Cerrar sesión en la app borra el registro de ese teléfono. |
