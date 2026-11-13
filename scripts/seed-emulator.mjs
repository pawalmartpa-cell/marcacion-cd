// Datos de ejemplo del prototipo, SOLO para el emulador local.
// Uso: con los emuladores corriendo → npm run seed
// Todas las cuentas tienen la contraseña 12345678.
import { FieldValue, GeoPoint, Timestamp } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
process.env.GCLOUD_PROJECT ||= 'demo-marcacion';
if (!process.env.GCLOUD_PROJECT.startsWith('demo-')) {
  console.error('Este script solo corre contra el emulador (proyecto demo-*).');
  process.exit(1);
}
const { iniciar, fechaSV } = await import('./_admin.mjs');
const { db, auth } = iniciar();

const hoy = fechaSV();
const ayer = new Date(Date.parse(`${hoy}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
const anteayer = new Date(Date.parse(`${hoy}T00:00:00Z`) - 2 * 86400000).toISOString().slice(0, 10);
/** Fecha ISO + HH:mm (El Salvador) → Timestamp */
const t = (iso, hhmm, masDias = 0) => {
  const d = new Date(`${iso}T${hhmm}:00-06:00`);
  return Timestamp.fromMillis(d.getTime() + masDias * 86400000);
};

// Horarios de ejemplo SOLO para el emulador (en producción el admin los define).
const turnos = [
  { nombre: 'Diurno', inicio: '06:00', fin: '14:00' },
  { nombre: 'Vespertino', inicio: '14:00', fin: '22:00' },
  { nombre: 'Nocturno', inicio: '22:00', fin: '06:00' },
];
const CDS = [
  { codigo: '5184', nombre: 'Hortifruti', lat: 13.6731, lng: -89.2794, qr: true, rot: 30 },
  { codigo: '7417', nombre: 'Apopa', lat: 13.8017, lng: -89.1793, qr: false, rot: 30 },
  { codigo: '7018', nombre: 'San Juan Opico', lat: 13.8742, lng: -89.3601, qr: true, rot: 60 },
];
const firma = (nombre, fuente) => ({
  tipo: 'generada',
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100" width="400" height="100"><text x="200" y="66" text-anchor="middle" font-family="${fuente}, cursive" font-size="50" fill="#041E42">${nombre}</text></svg>`,
  fuente,
  actualizadaEn: Timestamp.fromMillis(Date.now() - 40 * 86400000),
  cambioHabilitado: false,
});
const USERS = [
  ['admin', 'Admin', 'Principal', 'admin.cd@test.com', 'admin', '5184', 'activo', null],
  ['daniel', 'Daniel', 'Flores', 'daniel.flores@test.com', 'seguridad', '7417', 'pendiente', 'Great Vibes'],
  ['karla', 'Karla', 'Morales', 'karla.m@test.com', 'seguridad', '5184', 'pendiente', 'Allura'],
  ['carlos', 'Carlos', 'Méndez', 'carlos.mendez@test.com', 'seguridad', '5184', 'activo', 'Great Vibes'],
  ['ana', 'Ana', 'Rivas', 'ana.rivas@test.com', 'seguridad', '5184', 'activo', 'Dancing Script'],
  ['rosa', 'Rosa', 'Hernández', 'rosa.h@test.com', 'pa', '5184', 'activo', null],
  ['mario', 'Mario', 'Castillo', 'mario.c@test.com', 'pa', '7417', 'activo', null],
  ['kiosco5184', 'Kiosco', 'Garita 5184', 'kiosco5184@test.com', 'kiosco', '5184', 'activo', null],
  ['luis', 'Luis', 'Aguilar', 'luis.aguilar@test.com', 'seguridad', '7417', 'activo', 'Great Vibes'],
  ['jose', 'José', 'López', 'jose.lopez@test.com', 'seguridad', '7018', 'bloqueado', 'Dancing Script'],
  ['maria', 'María', 'Pérez', 'maria.perez@test.com', 'seguridad', '7018', 'activo', 'Great Vibes'],
  ['pedro', 'Pedro', 'Ramos', 'pedro.ramos@test.com', 'seguridad', '7417', 'activo', 'Dancing Script'],
  ['sofia', 'Sofía', 'Guzmán', 'sofia.g@test.com', 'seguridad', '7018', 'activo', 'Great Vibes'],
];

for (const c of CDS) {
  await db.doc(`cds/${c.codigo}`).set({
    nombre: c.nombre,
    codigo: c.codigo,
    ubicacion: new GeoPoint(c.lat, c.lng),
    radioValido: 150,
    radioAlerta: 1000,
    turnos,
    toleranciaMin: 10,
    qrHabilitado: c.qr,
    qrRotacionSeg: c.rot,
    paUids: c.codigo === '5184' ? ['rosa'] : c.codigo === '7417' ? ['mario'] : [],
    kioscoEmail: null,
  });
}
for (const [uid, nombre, apellidos, email, rol, cdId, estado, fuente] of USERS) {
  try {
    await auth.createUser({
      uid,
      email,
      password: '12345678',
      displayName: `${nombre} ${apellidos}`,
      emailVerified: true,
    });
  } catch (e) {
    if (e.code !== 'auth/uid-already-exists' && e.code !== 'auth/email-already-exists') throw e;
  }
  await db.doc(`users/${uid}`).set({
    uid,
    nombre,
    apellidos,
    email,
    rol,
    cdId,
    estado,
    proveedor: 'correo',
    deviceId: null,
    deviceIdPendiente: null,
    firma: fuente ? firma(`${nombre} ${apellidos}`, fuente) : null,
    consentimientoUbicacion: true,
    creadoEn: Timestamp.fromMillis(Date.now() - 60 * 86400000),
  });
}

const cdDe = Object.fromEntries(USERS.map((u) => [u[0], u[5]]));
const nombreDe = Object.fromEntries(USERS.map((u) => [u[0], `${u[1]} ${u[2]}`]));
const coord = (cd, m) => {
  const c = CDS.find((x) => x.codigo === cd);
  return { lat: c.lat + m / 111195, lng: c.lng };
};
const M = (cd, iso, hhmm, metros, zona, extra = {}) => {
  const p = metros == null ? { lat: null, lng: null } : coord(cd, metros);
  return {
    horaServidor: t(iso, hhmm, extra.dia ?? 0),
    horaDispositivo: t(iso, extra.dev ?? hhmm, extra.dia ?? 0),
    metodo: extra.metodo ?? (metros == null ? 'qr' : 'gps'),
    lat: p.lat,
    lng: p.lng,
    precision: metros == null ? null : 15,
    distanciaM: metros,
    zona,
    offline: !!extra.offline,
    deviceId: 'semilla',
    dispositivoDistinto: false,
    qrToken: metros == null && extra.metodo !== 'admin' ? 'SEMILLA' : null,
  };
};
const J = (id, uid, fecha, turno, entrada, salida, extra = {}) => ({
  id,
  uid,
  nombre: nombreDe[uid],
  cdId: cdDe[uid],
  fecha,
  turno: turnos.find((x) => x.nombre === turno),
  toleranciaMin: 10,
  entrada,
  salida,
  estado: salida ? 'cerrada' : 'abierta',
  editada: !!extra.editada,
  ultimaEdicionId: extra.editada ? 'semilla-log' : null,
  expiraEn: Timestamp.fromMillis(Date.now() + 90 * 86400000),
  creadoEn: entrada.horaServidor,
});
/** Hace `min` minutos → { iso, hhmm } en hora de El Salvador (para que "hoy" se vea real a cualquier hora). */
const hace = (min) => {
  const d = new Date(Date.now() - min * 60000 - 6 * 3600000).toISOString();
  return { iso: d.slice(0, 10), hhmm: d.slice(11, 16) };
};
const H = (cd, min, metros, zona, extra = {}) => {
  const r = hace(min);
  const dev = extra.devMin != null ? hace(extra.devMin).hhmm : undefined;
  return M(cd, r.iso, r.hhmm, metros, zona, { ...extra, dev });
};
const jornadas = [
  J('j1', 'carlos', hace(126).iso, 'Vespertino', H('5184', 126, null, 'valida'), null),
  J('j2', 'ana', hace(132).iso, 'Vespertino', H('5184', 132, 38, 'valida'), null),
  J('j3', 'luis', hace(140).iso, 'Vespertino', H('7417', 140, 1300, 'alerta'), null),
  J('j4', 'maria', hace(487).iso, 'Diurno', H('7018', 487, 20, 'valida'), H('7018', 60, 420, 'observacion')),
  J(
    'j5',
    'pedro',
    hace(483).iso,
    'Diurno',
    H('7417', 483, 15, 'valida'),
    H('7417', 30, 60, 'valida', { devMin: 48, offline: true }),
  ),
  J('j6', 'sofia', hace(494).iso, 'Diurno', H('7018', 494, 12, 'valida'), null),
  J(
    'j7',
    'carlos',
    ayer,
    'Vespertino',
    M('5184', ayer, '13:57', 25, 'valida'),
    M('5184', ayer, '22:03', 30, 'valida'),
  ),
  J(
    'j8',
    'ana',
    ayer,
    'Vespertino',
    M('5184', ayer, '13:50', null, 'valida'),
    M('5184', ayer, '22:01', null, 'valida'),
  ),
  J(
    'j9',
    'jose',
    ayer,
    'Nocturno',
    M('7018', ayer, '22:05', 40, 'valida'),
    M('7018', ayer, '06:00', null, 'valida', { dia: 1, metodo: 'admin' }),
    { editada: true },
  ),
  J('j10', 'luis', ayer, 'Nocturno', M('7417', ayer, '21:58', 18, 'valida'), null),
  J(
    'j11',
    'maria',
    ayer,
    'Diurno',
    M('7018', ayer, '06:10', 22, 'valida'),
    M('7018', ayer, '14:00', 35, 'valida'),
  ),
  J(
    'j12',
    'sofia',
    anteayer,
    'Diurno',
    M('7018', anteayer, '05:55', 10, 'valida'),
    M('7018', anteayer, '14:02', 14, 'valida'),
  ),
];
for (const { id, ...j } of jornadas) await db.doc(`jornadas/${id}`).set(j);

const A = (id, jid, parte, uid, severidad, tipo, texto, dist) =>
  db.doc(`alertas/${id}`).set({
    jornadaId: jid,
    uid,
    nombre: nombreDe[uid],
    cdId: cdDe[uid],
    parte,
    tipo,
    severidad,
    texto,
    distanciaM: dist,
    estado: 'abierta',
    resueltoPor: null,
    comentario: null,
    creadoEn: FieldValue.serverTimestamp(),
  });
await A(
  'j3_entrada',
  'j3',
  'entrada',
  'luis',
  'alta',
  'fuera_rango',
  'Entrada marcada a 1.3 km del CD (fuera del límite de 1 km)',
  1300,
);
await A(
  'j4_salida',
  'j4',
  'salida',
  'maria',
  'media',
  'observacion',
  'Salida a 420 m (entre 150 m y 1 km)',
  420,
);
await A(
  'j5_salida',
  'j5',
  'salida',
  'pedro',
  'info',
  'sin_conexion',
  `Marca sin conexión: hora del celular ${hace(48).hhmm}`,
  60,
);
await A(
  'j10_salida',
  'j10',
  'salida',
  'luis',
  'media',
  'sin_salida',
  'No marcó salida del turno nocturno de ayer',
  null,
);

const L = (
  detalle,
  quien = 'admin',
  quienNombre = 'Admin Principal',
  rol = 'admin',
  cdId = null,
  motivo = null,
) =>
  db
    .collection('bitacora')
    .add({
      quien,
      quienNombre,
      rol,
      accion: 'semilla',
      detalle,
      motivo,
      refTipo: null,
      refId: null,
      cdId,
      antes: null,
      despues: null,
      fecha: FieldValue.serverTimestamp(),
    });
await L('Aprobó el registro de Sofía Guzmán (Seguridad · San Juan Opico 7018)');
await db.doc('bitacora/semilla-log').set({
  quien: 'admin',
  quienNombre: 'Admin Principal',
  rol: 'admin',
  accion: 'corregir_jornada',
  detalle: 'Corrigió la jornada de José López: salida — → 06:00',
  motivo: 'Verificado con hoja de papel',
  refTipo: 'jornada',
  refId: 'j9',
  cdId: '7018',
  antes: null,
  despues: null,
  fecha: FieldValue.serverTimestamp(),
});
await L('Bloqueó a José López');
await L('Aceptó la marca con observación de Ana Rivas', 'rosa', 'Rosa Hernández', 'pa', '5184');

await db
  .doc('config/general')
  .set({ diasRetencion: 90, diasCambioFirma: 30, nombreApp: 'Marcación CD', tema: 'auto' });
await db.collection('notificaciones').add({
  para: 'admin',
  uid: null,
  cdId: '7417',
  tipo: 'registro',
  texto: 'Daniel Flores se registró y espera aprobación',
  enlace: 'usuarios',
  creadoPor: 'daniel',
  creadoEn: FieldValue.serverTimestamp(),
  leidaPor: [],
});

console.log('✓ Datos de ejemplo cargados en el emulador. Contraseña de todas las cuentas: 12345678');
console.log(
  '  Admin: admin.cd@test.com · PA: rosa.h@test.com · Guardia: carlos.mendez@test.com · Kiosco: kiosco5184@test.com',
);
