// Da rol Admin y estado Activo al usuario con el correo indicado.
// Uso (GitHub Actions → make-admin): EMAIL=persona@gmail.com node scripts/make-admin.mjs
import { FieldValue, GeoPoint } from 'firebase-admin/firestore';
import { iniciar } from './_admin.mjs';

const email = (process.env.EMAIL || process.argv[2] || '').trim().toLowerCase();
const crearCds = process.env.CREAR_CDS === 'true';
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Escribe un correo válido.');
  process.exit(1);
}

const { db, auth } = iniciar();

let user;
try {
  user = await auth.getUserByEmail(email);
} catch {
  console.error(`No existe una cuenta con ${email}.`);
  console.error(
    'Primero abre la app e inicia sesión una vez con ese correo (Google o registro con correo), y vuelve a ejecutar este workflow.',
  );
  process.exit(1);
}

if (crearCds) {
  // CD del prototipo. Los horarios quedan vacíos ([hh:mm]) para que el admin los configure.
  const turnos = ['Diurno', 'Vespertino', 'Nocturno'].map((nombre) => ({ nombre, inicio: '', fin: '' }));
  const cds = [
    { codigo: '5184', nombre: 'Hortifruti', lat: 13.6731, lng: -89.2794 },
    { codigo: '7417', nombre: 'Apopa', lat: 13.8017, lng: -89.1793 },
    { codigo: '7018', nombre: 'San Juan Opico', lat: 13.8742, lng: -89.3601 },
  ];
  for (const c of cds) {
    const ref = db.doc(`cds/${c.codigo}`);
    if ((await ref.get()).exists) continue;
    await ref.set({
      nombre: c.nombre,
      codigo: c.codigo,
      ubicacion: new GeoPoint(c.lat, c.lng),
      radioValido: 150,
      radioAlerta: 1000,
      turnos,
      toleranciaMin: 10,
      qrHabilitado: false,
      qrRotacionSeg: 30,
      paUids: [],
      kioscoEmail: null,
    });
    console.log(`✓ CD ${c.nombre} ${c.codigo} creado (ajusta la ubicación y los horarios en la app)`);
  }
}

const ref = db.doc(`users/${user.uid}`);
const snap = await ref.get();
if (snap.exists) {
  await ref.update({ rol: 'admin', estado: 'activo' });
} else {
  const partes = (user.displayName || email.split('@')[0]).split(' ');
  const primerCd = (await db.collection('cds').limit(1).get()).docs[0]?.id ?? '';
  await ref.set({
    uid: user.uid,
    nombre: partes.slice(0, Math.ceil(partes.length / 2)).join(' ') || 'Admin',
    apellidos: partes.slice(Math.ceil(partes.length / 2)).join(' ') || 'Principal',
    email,
    rol: 'admin',
    cdId: primerCd,
    estado: 'activo',
    proveedor: user.providerData.some((p) => p.providerId === 'google.com') ? 'google' : 'correo',
    deviceId: null,
    deviceIdPendiente: null,
    firma: null,
    consentimientoUbicacion: true,
    creadoEn: FieldValue.serverTimestamp(),
  });
}
await db.collection('bitacora').add({
  quien: 'sistema',
  quienNombre: 'GitHub Actions (make-admin)',
  rol: 'admin',
  accion: 'nombrar_admin',
  detalle: `Dio rol de administrador a ${email} desde GitHub Actions`,
  motivo: null,
  refTipo: 'usuario',
  refId: user.uid,
  cdId: null,
  antes: snap.exists ? { rol: snap.get('rol'), estado: snap.get('estado') } : null,
  despues: { rol: 'admin', estado: 'activo' },
  fecha: FieldValue.serverTimestamp(),
});
console.log(`✓ ${email} ahora es Admin y está Activo. Cierra sesión y vuelve a entrar en la app.`);
