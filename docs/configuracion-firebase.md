# Configuración de Firebase y GitHub (todo desde el celular)

Estos pasos se hacen **una sola vez**, desde el navegador del celular. No hace falta instalar nada ni
poner tarjeta: todo queda en el plan gratuito **Spark**.

> Consejo: en Chrome del celular, abre el menú ⋮ y activa **"Sitio de escritorio"** cuando una
> pantalla de Firebase o de Google Cloud se vea cortada.

Tiempo aproximado: 30 minutos.

---

## 1. Crear el proyecto en Firebase (plan Spark)

1. Entra a <https://console.firebase.google.com> con tu cuenta de Google.
2. Toca **"Crear un proyecto"** (o "Agregar proyecto").
3. Nombre: `marcacion-cd` (Firebase le agrega letras al final; ese es el **ID del proyecto**, anótalo).
4. Acepta las condiciones y toca **Continuar**.
5. **Desactiva Google Analytics** (no se usa) y toca **Crear proyecto**.
6. Espera y toca **Continuar**. El proyecto queda en el plan **Spark (gratis)**. Nunca te pedirá
   tarjeta mientras no toques "Actualizar plan". **No lo actualices.**

## 2. Activar el inicio de sesión con Google y con correo

1. En el menú ☰ de la izquierda: **Compilación → Authentication** → **Comenzar**.
2. Pestaña **Método de acceso**:
   - Toca **Google** → activa el interruptor → elige tu correo en "Correo de asistencia" →
     **Guardar**.
   - Toca **Agregar proveedor nuevo** → **Correo electrónico/contraseña** → activa solo el primer
     interruptor → **Guardar**.
3. Pestaña **Plantillas** → toca el ícono del lápiz o **Idioma de la plantilla** → elige
   **Español** → **Guardar**. (Así los correos de "recuperar contraseña" y "verificar correo" llegan
   en español).
4. Pestaña **Configuración → Dominios autorizados**: ya deben aparecer `TU-ID.firebaseapp.com` y
   `TU-ID.web.app`. No cambies nada.

## 3. Crear la base de datos Firestore

1. Menú ☰ → **Compilación → Firestore Database** → **Crear base de datos**.
2. Si te pide edición, elige **Standard**.
3. Ubicación: elige **`nam5 (United States)`** o **`us-east1`** (las más cercanas y gratis). *No se
   puede cambiar después.*
4. Elige **"Iniciar en modo de producción"** → **Crear**.
   (Las reglas reales las sube GitHub Actions automáticamente al desplegar.)

## 4. Registrar la app web y copiar la configuración

1. Toca el engrane ⚙ (arriba a la izquierda) → **Configuración del proyecto**.
2. En la pestaña **General**, baja hasta **"Tus apps"** y toca el ícono **`</>`** (Web).
3. Apodo: `marcacion-web`. **No** marques "Firebase Hosting" (lo hace GitHub). Toca **Registrar app**.
4. Verás un bloque de código con `const firebaseConfig = { ... }`. Copia estos 6 valores a una nota
   (sin las comillas):

   | Valor en Firebase   | Nombre del secreto en GitHub          |
   |---------------------|---------------------------------------|
   | `apiKey`            | `VITE_FIREBASE_API_KEY`               |
   | `authDomain`        | `VITE_FIREBASE_AUTH_DOMAIN`           |
   | `projectId`         | `VITE_FIREBASE_PROJECT_ID`            |
   | `storageBucket`     | `VITE_FIREBASE_STORAGE_BUCKET`        |
   | `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID`   |
   | `appId`             | `VITE_FIREBASE_APP_ID`                |

   Estos datos son públicos (van dentro de la app), pero igual los guardamos como secretos para no
   subirlos al repositorio.

## 5. Generar la cuenta de servicio (para GitHub Actions)

GitHub la usa para desplegar, para `make-admin` y para la limpieza nocturna.

1. ⚙ → **Configuración del proyecto** → pestaña **Cuentas de servicio**.
2. Toca **"Generar nueva clave privada"** → **Generar clave**. Se descarga un archivo `.json`.
3. Ábrelo en el celular (app **Archivos** → Descargas → tócalo; si pregunta, ábrelo con un visor de
   texto o con Google Drive) y **copia todo el contenido**, desde la primera `{` hasta la última `}`.
4. **Dale permisos para desplegar** (una sola vez):
   1. Abre <https://console.cloud.google.com/iam-admin/iam> (con el mismo usuario de Google) y elige
      tu proyecto arriba.
   2. Busca la cuenta que empieza con `firebase-adminsdk-` y toca el **lápiz** ✏️.
   3. **Agregar otro rol** → busca y agrega **"Administrador de Firebase"** (Firebase Admin).
   4. **Agregar otro rol** → busca y agrega **"Consumidor de Service Usage"** (Service Usage Consumer).
   5. **Guardar**.
   > Si al desplegar aparece un error de permisos (`403` / `PERMISSION_DENIED`), agrega también el rol
   > **"Editor"** a esa misma cuenta y vuelve a ejecutar el workflow.
5. **Nunca** pegues esta clave en el chat, en un archivo del repositorio ni en otro lugar que no sea
   el secreto de GitHub del paso 6. Después de guardarla, puedes borrar el archivo descargado.

## 6. Cargar los secretos en GitHub

1. Abre tu repositorio en <https://github.com> (en el navegador; la app de GitHub no permite
   secretos).
2. **Settings** (si no lo ves, menú ⋯) → **Secrets and variables** → **Actions**.
3. Toca **New repository secret** y crea estos 7, uno por uno (nombre exacto, valor sin comillas):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `FIREBASE_SERVICE_ACCOUNT` → pega **todo** el JSON del paso 5.
4. Pestaña **Actions** del repositorio: si aparece un botón para habilitar los workflows, tócalo.

## 7. Primer despliegue y primer administrador (`make-admin`)

1. Fusiona (merge) el Pull Request en `main`. Se ejecuta solo el workflow **Desplegar**
   (pestaña **Actions**). Cuando termine con ✅, la app queda en
   `https://TU-ID.web.app`.
2. Abre esa dirección en el celular e **inicia sesión una vez con tu cuenta de Google** (verás
   "Completa tu perfil"; puedes dejarla ahí).
3. En GitHub: **Actions → make-admin → Run workflow**:
   - `email`: tu correo de Google.
   - `crear_cds`: márcalo si quieres que se creen los 3 CD del prototipo (Hortifruti 5184,
     Apopa 7417, San Juan Opico 7018). Luego ajustas en la app su ubicación exacta y los horarios.
   - Toca **Run workflow** y espera el ✅.
4. Vuelve a la app y recarga: entrarás al **panel de administrador**.
5. En la app: **Centros de distribución** → abre cada CD → toca **"Usar mi ubicación actual"**
   estando en el CD (o mueve el punto en el mapa) → escribe los horarios de los 3 turnos →
   **Guardar cambios**.

### Instalar la app en Android, iPhone o PC

- **Android (Chrome):** abre la dirección → menú ⋮ → **"Instalar app"** / "Agregar a pantalla de
  inicio". Queda como una app normal y funciona sin conexión.
- **iPhone (Safari):** botón Compartir → **"Agregar a inicio"**.
- **PC (Chrome/Edge):** ícono de instalar en la barra de direcciones.
- ¿Quieres publicarla en Google Play más adelante? Se puede generar el paquete Android desde
  <https://www.pwabuilder.com> poniendo la dirección de la app (también desde el navegador).

## Limpieza automática

El workflow **purga** corre solo todos los días a las 23:00 (hora de El Salvador). Puedes
ejecutarlo a mano en **Actions → purga → Run workflow** (marca "simular" para solo contar).
GitHub pausa los workflows programados si el repositorio pasa **60 días sin actividad**; si eso
ocurre, en Actions aparece un botón para reactivarlo.

## Si algo falla

| Síntoma | Solución |
|---|---|
| El workflow Desplegar dice "Faltan secretos" | Revisa el paso 6: nombres exactos, sin espacios. |
| `PERMISSION_DENIED` al desplegar | Paso 5.4 (roles de la cuenta de servicio). |
| `make-admin`: "No existe una cuenta con…" | Primero inicia sesión una vez en la app con ese correo. |
| Google dice "dominio no autorizado" | Authentication → Configuración → Dominios autorizados: agrega el dominio que uses. |
| La app dice "Falta configurar Firebase" | Los secretos `VITE_FIREBASE_*` no llegaron al build: revísalos y vuelve a ejecutar Desplegar. |
