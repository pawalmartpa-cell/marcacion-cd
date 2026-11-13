// Limpieza diaria (GitHub Actions → purga, 23:00 de El Salvador).
// Borra por completo jornadas, alertas, notificaciones y solicitudes más antiguas que
// config/general.diasRetencion, en lotes de 400, sin pasar del límite gratuito de 20 000 borrados al día.
// También crea la alerta "no marcó salida" para jornadas abiertas de días anteriores.
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { iniciar, fechaSV } from './_admin.mjs';

const LOTE = 400;
const LIMITE_DIARIO = Number(process.env.LIMITE_BORRADOS || 19000); // margen bajo 20 000
const SIMULAR = process.env.SIMULAR === 'true';

const { db } = iniciar();

const cfg = (await db.doc('config/general').get()).data() ?? {};
const dias = Math.min(180, Math.max(30, Number(cfg.diasRetencion) || 90));
const hoy = fechaSV();
const limiteISO = new Date(Date.parse(`${hoy}T00:00:00Z`) - dias * 86400000).toISOString().slice(0, 10);
const limiteTs = Timestamp.fromDate(new Date(`${limiteISO}T06:00:00Z`)); // medianoche de El Salvador
console.log(
  `Retención: ${dias} días. Se borra todo lo anterior al ${limiteISO}.${SIMULAR ? ' (SIMULACIÓN)' : ''}`,
);

let presupuesto = LIMITE_DIARIO;
const borrados = {};

async function purgar(nombre, campo, valor) {
  borrados[nombre] = 0;
  while (presupuesto > 0) {
    const tam = Math.min(LOTE, presupuesto);
    const snap = await db.collection(nombre).where(campo, '<', valor).orderBy(campo).limit(tam).get();
    if (snap.empty) break;
    if (!SIMULAR) {
      const b = db.batch();
      snap.docs.forEach((d) => b.delete(d.ref));
      await b.commit();
    }
    borrados[nombre] += snap.size;
    presupuesto -= snap.size;
    if (snap.size < tam || SIMULAR) break;
  }
  console.log(`  ${nombre}: ${borrados[nombre]}`);
}

await purgar('jornadas', 'fecha', limiteISO);
await purgar('alertas', 'creadoEn', limiteTs);
await purgar('notificaciones', 'creadoEn', limiteTs);
await purgar('solicitudes', 'creadoEn', limiteTs);
await purgar('reportes', 'fecha', limiteTs);

// Alertas de salida sin marcar (jornadas abiertas de antes de ayer o de ayer con más de 20 h).
const ayer = new Date(Date.parse(`${hoy}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
const abiertas = await db
  .collection('jornadas')
  .where('estado', '==', 'abierta')
  .where('fecha', '<=', ayer)
  .get();
let sinSalida = 0;
for (const d of abiertas.docs) {
  const j = d.data();
  const ent = j.entrada?.horaServidor?.toDate?.() ?? new Date();
  if (Date.now() - ent.getTime() < 20 * 3600 * 1000) continue;
  const aRef = db.doc(`alertas/${d.id}_salida`);
  if ((await aRef.get()).exists) continue;
  const [y, m, dd] = j.fecha.split('-');
  if (!SIMULAR)
    await aRef.set({
      jornadaId: d.id,
      uid: j.uid,
      nombre: j.nombre,
      cdId: j.cdId,
      parte: 'salida',
      tipo: 'sin_salida',
      severidad: 'media',
      texto: `No marcó salida del turno ${String(j.turno?.nombre ?? '').toLowerCase()} del ${dd}/${m}/${y}`,
      distanciaM: null,
      estado: 'abierta',
      resueltoPor: null,
      comentario: null,
      creadoEn: FieldValue.serverTimestamp(),
    });
  if (!SIMULAR)
    await db.collection('notificaciones').add({
      para: 'staff',
      uid: null,
      cdId: j.cdId,
      tipo: 'alerta',
      texto: `${j.nombre}: no marcó salida del ${dd}/${m}/${y}`,
      enlace: `alertas/${d.id}_salida`,
      creadoPor: 'sistema',
      creadoEn: FieldValue.serverTimestamp(),
      leidaPor: [],
    });
  sinSalida++;
}
console.log(`  alertas "sin salida" nuevas: ${sinSalida}`);

const total = Object.values(borrados).reduce((a, b) => a + b, 0);
const detalle =
  `Limpieza automática (retención ${dias} días, antes del ${limiteISO.split('-').reverse().join('/')}): ` +
  `borró ${borrados.jornadas} jornadas, ${borrados.alertas} alertas, ${borrados.notificaciones} notificaciones, ` +
  `${borrados.solicitudes} solicitudes y ${borrados.reportes} reportes. ${sinSalida} alertas de salida sin marcar.` +
  (presupuesto <= 0 ? ' Se alcanzó el límite diario; continúa mañana.' : '');
if (!SIMULAR) {
  await db.collection('bitacora').add({
    quien: 'sistema',
    quienNombre: 'Limpieza automática',
    rol: 'admin',
    accion: 'purga',
    detalle,
    motivo: null,
    refTipo: null,
    refId: null,
    cdId: null,
    antes: null,
    despues: { ...borrados, sinSalida, dias },
    fecha: FieldValue.serverTimestamp(),
  });
}
console.log(`✓ ${detalle} (total ${total})`);
