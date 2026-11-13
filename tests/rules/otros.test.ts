import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  GeoPoint,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { alertaNueva, bitacoraNueva, cdBase, como, crearEntorno, sembrar } from './helpers';

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await crearEntorno();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await sembrar(env);
});

describe('Kioscos', () => {
  const lote = () => ({
    cdId: '5184',
    rotSeg: 30,
    actualizadoEn: serverTimestamp(),
    tokens: { ABC: { desde: Timestamp.now(), hasta: Timestamp.fromMillis(Date.now() + 30000) } },
  });
  it('el kiosco de su CD lee y escribe el lote', async () => {
    const db = como(env, 'kiosco5184').firestore();
    await assertSucceeds(getDoc(doc(db, 'kioscos/5184')));
    await assertSucceeds(setDoc(doc(db, 'kioscos/5184'), lote()));
  });
  it('el kiosco de otro CD no', async () => {
    const db = como(env, 'kiosco7417').firestore();
    await assertFails(getDoc(doc(db, 'kioscos/5184')));
    await assertFails(setDoc(doc(db, 'kioscos/5184'), lote()));
  });
  it('admin y PA del CD lo leen; guardia no escribe', async () => {
    await assertSucceeds(getDoc(doc(como(env, 'admin').firestore(), 'kioscos/5184')));
    await assertSucceeds(getDoc(doc(como(env, 'pa5184').firestore(), 'kioscos/5184')));
    await assertFails(getDoc(doc(como(env, 'pa7417').firestore(), 'kioscos/5184')));
    await assertFails(setDoc(doc(como(env, 'g1').firestore(), 'kioscos/5184'), lote()));
  });
});

describe('Bitácora', () => {
  it('admin agrega; nadie edita ni borra', async () => {
    const db = como(env, 'admin').firestore();
    await assertSucceeds(setDoc(doc(db, 'bitacora/b1'), bitacoraNueva('admin', 'admin', null)));
    await assertFails(updateDoc(doc(db, 'bitacora/b1'), { detalle: 'cambiado' }));
    await assertFails(deleteDoc(doc(db, 'bitacora/b1')));
  });
  it('no se puede firmar como otra persona ni con otra hora', async () => {
    const db = como(env, 'admin').firestore();
    await assertFails(setDoc(doc(db, 'bitacora/b1'), bitacoraNueva('pa5184', 'pa', null)));
    await assertFails(
      setDoc(doc(db, 'bitacora/b2'), bitacoraNueva('admin', 'admin', null, { fecha: Timestamp.now() })),
    );
  });
  it('PA agrega y lee solo de su CD; guardia no lee ni escribe', async () => {
    const pa = como(env, 'pa5184').firestore();
    await assertSucceeds(setDoc(doc(pa, 'bitacora/b1'), bitacoraNueva('pa5184', 'pa', null)));
    await assertFails(setDoc(doc(pa, 'bitacora/b2'), bitacoraNueva('pa5184', 'pa', null, { cdId: '7417' })));
    await assertSucceeds(getDocs(query(collection(pa, 'bitacora'), where('cdId', '==', '5184'))));
    await assertFails(getDocs(collection(pa, 'bitacora')));
    const g = como(env, 'g1').firestore();
    await assertFails(getDoc(doc(g, 'bitacora/b1')));
    await assertFails(setDoc(doc(g, 'bitacora/b3'), bitacoraNueva('g1', 'seguridad', null)));
  });
});

describe('Alertas', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'alertas/j1_entrada'), {
        ...alertaNueva('j1', 'entrada'),
        creadoEn: Timestamp.now(),
      });
      await setDoc(doc(ctx.firestore(), 'alertas/j9_entrada'), {
        ...alertaNueva('j9', 'entrada', 'g7417'),
        cdId: '7417',
        creadoEn: Timestamp.now(),
      });
    });
  });
  const resolver = (uid: string, estado = 'aceptada') => ({
    estado,
    resueltoPor: uid,
    resueltoNombre: 'X',
    comentario: 'Verificado',
    resueltoEn: serverTimestamp(),
  });
  it('PA acepta o rechaza las de su CD', async () => {
    const db = como(env, 'pa5184').firestore();
    await assertSucceeds(updateDoc(doc(db, 'alertas/j1_entrada'), resolver('pa5184', 'rechazada')));
    await assertFails(updateDoc(doc(db, 'alertas/j9_entrada'), resolver('pa5184')));
  });
  it('no puede cambiar otros campos', async () => {
    const db = como(env, 'pa5184').firestore();
    await assertFails(updateDoc(doc(db, 'alertas/j1_entrada'), { ...resolver('pa5184'), texto: 'otro' }));
  });
  it('el guardia no lee alertas', async () => {
    await assertFails(getDoc(doc(como(env, 'g1').firestore(), 'alertas/j1_entrada')));
  });
  it('el guardia no crea alertas sueltas sin su jornada', async () => {
    await assertFails(
      setDoc(doc(como(env, 'g1').firestore(), 'alertas/x_entrada'), alertaNueva('x', 'entrada')),
    );
  });
});

describe('CDs y configuración', () => {
  it('cualquiera con sesión lee los CD', async () => {
    await assertSucceeds(getDoc(doc(como(env, 'nuevo').firestore(), 'cds/5184')));
  });
  it('solo admin crea o edita CD; PA solo activa/desactiva su QR', async () => {
    await assertSucceeds(setDoc(doc(como(env, 'admin').firestore(), 'cds/7018'), cdBase('7018')));
    await assertFails(setDoc(doc(como(env, 'pa5184').firestore(), 'cds/7019'), cdBase('7019')));
    await assertSucceeds(
      updateDoc(doc(como(env, 'pa5184').firestore(), 'cds/5184'), { qrHabilitado: false }),
    );
    await assertFails(updateDoc(doc(como(env, 'pa5184').firestore(), 'cds/5184'), { radioValido: 900 }));
    await assertFails(updateDoc(doc(como(env, 'pa5184').firestore(), 'cds/7417'), { qrHabilitado: true }));
  });
  it('valida radios y rotación', async () => {
    const db = como(env, 'admin').firestore();
    await assertFails(setDoc(doc(db, 'cds/7018'), cdBase('7018', { radioAlerta: 100 })));
    await assertFails(setDoc(doc(db, 'cds/7018'), cdBase('7018', { qrRotacionSeg: 5 })));
    await assertFails(setDoc(doc(db, 'cds/7018'), cdBase('7018', { ubicacion: 'aquí' })));
    await assertSucceeds(
      setDoc(doc(db, 'cds/7018'), cdBase('7018', { ubicacion: new GeoPoint(13.87, -89.36) })),
    );
  });
  it('config: solo admin y dentro de los rangos', async () => {
    const ok = { diasRetencion: 60, diasCambioFirma: 30, nombreApp: 'Marcación CD', tema: 'oscuro' };
    await assertSucceeds(setDoc(doc(como(env, 'admin').firestore(), 'config/general'), ok));
    await assertFails(
      setDoc(doc(como(env, 'admin').firestore(), 'config/general'), { ...ok, diasRetencion: 365 }),
    );
    await assertFails(setDoc(doc(como(env, 'pa5184').firestore(), 'config/general'), ok));
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'config/general')));
  });
});

describe('Notificaciones y solicitudes', () => {
  const notif = (extra: Record<string, unknown> = {}) => ({
    para: 'staff',
    uid: null,
    cdId: '5184',
    tipo: 'firma',
    texto: 'Cambió su firma',
    enlace: null,
    creadoPor: 'g1',
    creadoEn: serverTimestamp(),
    leidaPor: [],
    ...extra,
  });
  it('el guardia avisa a los PA/admin de su CD', async () => {
    const db = como(env, 'g1').firestore();
    await assertSucceeds(addDoc(collection(db, 'notificaciones'), notif()));
    await assertFails(addDoc(collection(db, 'notificaciones'), notif({ cdId: '7417' })));
    await assertFails(addDoc(collection(db, 'notificaciones'), notif({ para: 'usuario', uid: 'g2' })));
  });
  it('los avisos "solo admin" no los ve el PA ni el guardia', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'notificaciones/a1'), {
        ...notif({ para: 'admin', tipo: 'registro', creadoPor: 'gpend' }),
        creadoEn: Timestamp.now(),
      });
    });
    await assertSucceeds(getDoc(doc(como(env, 'admin').firestore(), 'notificaciones/a1')));
    await assertFails(getDoc(doc(como(env, 'pa5184').firestore(), 'notificaciones/a1')));
    await assertFails(getDoc(doc(como(env, 'g1').firestore(), 'notificaciones/a1')));
    await assertSucceeds(
      getDocs(
        query(
          collection(como(env, 'admin').firestore(), 'notificaciones'),
          where('para', 'in', ['staff', 'admin']),
        ),
      ),
    );
    await assertFails(
      getDocs(
        query(
          collection(como(env, 'pa5184').firestore(), 'notificaciones'),
          where('para', '==', 'admin'),
          where('cdId', '==', '5184'),
        ),
      ),
    );
  });

  it('el guardia avisa solo a los admins (registro/solicitud) de su CD', async () => {
    const db = como(env, 'g1').firestore();
    await assertSucceeds(
      addDoc(collection(db, 'notificaciones'), notif({ para: 'admin', tipo: 'solicitud' })),
    );
    await assertFails(
      addDoc(collection(db, 'notificaciones'), notif({ para: 'admin', tipo: 'solicitud', cdId: '7417' })),
    );
  });

  it('el usuario pendiente avisa de su registro', async () => {
    const db = como(env, 'gpend').firestore();
    await assertSucceeds(
      addDoc(collection(db, 'notificaciones'), notif({ creadoPor: 'gpend', tipo: 'registro' })),
    );
  });
  it('el usuario lee solo las suyas y las marca leídas', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'notificaciones/n1'), {
        ...notif({ para: 'usuario', uid: 'g1', creadoPor: 'admin' }),
        creadoEn: Timestamp.now(),
      });
      await setDoc(doc(ctx.firestore(), 'notificaciones/n2'), { ...notif(), creadoEn: Timestamp.now() });
    });
    const db = como(env, 'g1').firestore();
    await assertSucceeds(getDoc(doc(db, 'notificaciones/n1')));
    await assertFails(getDoc(doc(db, 'notificaciones/n2')));
    await assertSucceeds(updateDoc(doc(db, 'notificaciones/n1'), { leidaPor: ['g1'] }));
    await assertFails(updateDoc(doc(db, 'notificaciones/n1'), { texto: 'x' }));
    await assertSucceeds(getDoc(doc(como(env, 'pa5184').firestore(), 'notificaciones/n2')));
    await assertFails(getDoc(doc(como(env, 'pa7417').firestore(), 'notificaciones/n2')));
  });
  const sol = (uid = 'g1', extra: Record<string, unknown> = {}) => ({
    uid,
    nombre: 'Nombre ' + uid,
    cdId: '5184',
    jornadaId: null,
    fecha: '2026-11-10',
    tipo: 'olvido_salida',
    texto: 'Olvidé marcar la salida',
    estado: 'abierta',
    respuesta: null,
    creadoEn: serverTimestamp(),
    ...extra,
  });
  it('el guardia crea sus solicitudes; el admin las resuelve', async () => {
    const g = como(env, 'g1').firestore();
    await assertSucceeds(setDoc(doc(g, 'solicitudes/s1'), sol()));
    await assertFails(setDoc(doc(g, 'solicitudes/s2'), sol('g2')));
    await assertFails(updateDoc(doc(g, 'solicitudes/s1'), { estado: 'resuelta' }));
    await assertFails(
      updateDoc(doc(como(env, 'pa5184').firestore(), 'solicitudes/s1'), {
        estado: 'resuelta',
        respuesta: null,
        resueltoEn: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(como(env, 'admin').firestore(), 'solicitudes/s1'), {
        estado: 'resuelta',
        respuesta: 'Corregido',
        resueltoEn: serverTimestamp(),
      }),
    );
  });
});

describe('Tokens push', () => {
  const tok = (uid: string, extra: Record<string, unknown> = {}) => ({
    uid,
    dispositivo: 'Android',
    actualizadoEn: serverTimestamp(),
    ...extra,
  });
  it('cada usuario registra y borra solo su teléfono', async () => {
    const db = como(env, 'pa5184').firestore();
    await assertSucceeds(setDoc(doc(db, 'tokensPush/abc:123'), tok('pa5184')));
    await assertSucceeds(getDoc(doc(db, 'tokensPush/abc:123')));
    await assertFails(setDoc(doc(db, 'tokensPush/xyz'), tok('admin')));
    await assertFails(setDoc(doc(db, 'tokensPush/xyz'), tok('pa5184', { actualizadoEn: Timestamp.now() })));
    await assertFails(getDoc(doc(como(env, 'g1').firestore(), 'tokensPush/abc:123')));
    await assertFails(deleteDoc(doc(como(env, 'g1').firestore(), 'tokensPush/abc:123')));
    await assertSucceeds(deleteDoc(doc(db, 'tokensPush/abc:123')));
  });
  it('nadie lista los tokens de otros desde la app', async () => {
    await assertFails(getDocs(collection(como(env, 'admin').firestore(), 'tokensPush')));
  });
});
