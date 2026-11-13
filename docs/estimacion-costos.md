# Estimación de uso del plan gratuito (Spark)

Supuestos: **25 guardias**, 3 CD con kiosco, 2–4 marcas por guardia al día, 3 coordinadores/admins
que abren el panel ~5 veces al día cada uno, retención de 90 días.

| Recurso (por día) | Límite gratis | Uso estimado | % |
|---|---|---|---|
| **Escrituras** | 20 000 | ≈ 250 | ≈ 1 % |
| **Lecturas** | 50 000 | ≈ 8 000 – 15 000 | 16 – 30 % |
| **Borrados** | 20 000 | ≈ 150 – 250 (purga nocturna) | ≈ 1 % |
| **Almacenamiento** | 1 GiB | ≈ 25 MiB con 90 días | ≈ 2.5 % |
| **Hosting (transferencia)** | 360 MB/día | ≈ 30–100 MB los días de actualización | ≤ 30 % |
| **Auth (Google y correo)** | sin límite práctico en Spark | 25–40 usuarios | — |

## Detalle

**Escrituras ≈ 250/día**
- Marcas: 25 guardias × 4 marcas = 100 (entrada = 1 escritura, salida = 1 escritura).
- Alertas: ≈ 10–20 (solo marcas fuera de radio, sin conexión u otro teléfono).
- Kiosco QR: 1 escritura por hora por kiosco = 24 × 3 = **72** (gracias al lote de tokens; rotar
  cada 30 s escribiendo cada vez serían 8 640 al día).
- Bitácora, notificaciones, solicitudes y correcciones: ≈ 30–60.

**Lecturas ≈ 8 000–15 000/día**
- App del guardia: al abrirla escucha su perfil, su CD, la configuración, su jornada abierta y sus
  jornadas de 8 días (≈ 15–30 lecturas). 25 guardias × 4 aperturas ≈ 3 000.
- Kiosco: solo lee los cambios (cada marca nueva = 1 lectura) ≈ 300.
- Panel admin/PA: usuarios + CD + alertas recientes (máx. 300) + jornadas del rango.
  ≈ 400–800 por apertura × 15 aperturas ≈ 6 000–12 000.
- Los oyentes en tiempo real solo cobran los documentos que cambian mientras la pantalla está
  abierta. Si un oyente estuvo desconectado más de 30 minutos, se vuelve a cobrar la consulta
  completa.

**Borrados**: la purga borra cada noche lo que vence, lo mismo que se escribió hace 90 días
(≈ 150–250). El script se detiene en **19 000** para nunca pasar de 20 000; si quedara algo, sigue
la noche siguiente.

**Almacenamiento**: una jornada con índices pesa ≈ 2.6 KB → 25 × 1.5 × 90 ≈ 3 400 jornadas ≈ 9 MB,
más usuarios con firma (≈ 9 KB c/u), alertas y bitácora → < 30 MB.

**Hosting**: la app completa pesa ≈ 2.5 MB (los teléfonos de guardias no descargan las librerías
de Excel/PDF). Se descarga una vez por teléfono y luego solo lo que cambia en cada versión.

## Notificaciones push (Cloudflare Worker + FCM)

- FCM: gratis y sin límite.
- Cloudflare Workers gratis: 100 000 solicitudes al día. Se usan ≈ 1 440 por el respaldo de cada
  minuto más una por aviso, menos del 2 %.
- Firestore: el respaldo de cada minuto cuesta ≈ 1 lectura (≈ 1 440 al día) y cada aviso enviado
  ≈ 5–10 lecturas y 2 escrituras. Aun así el total queda muy por debajo del límite gratis.

## Cómo mantenerlo en $0

- No cambies el plan a Blaze (no hace falta para nada de esta app).
- No se usan Cloud Functions, Cloud Storage ni políticas TTL de Firestore.
- Si algún día crece mucho la cantidad de guardias, el punto a vigilar son las **lecturas del
  panel**: usa el filtro por CD y rangos de fechas cortos.
- En **Configuración → Uso del plan gratis** se ve el almacenamiento y la cantidad de documentos.
- Firebase envía un correo si un día te acercas a un límite; en Spark, al pasarlo la app solo se
  pausa hasta el día siguiente (nunca cobra).
