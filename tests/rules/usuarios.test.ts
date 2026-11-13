import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  Timestamp,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { como, crearEntorno, sembrar } from './helpers';

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

const firmaNueva = () => ({
  tipo: 'generada',
  svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>Nueva firma</text></svg>',
  fuente: 'Allura',
  actualizadaEn: serverTimestamp(),
  cambioHabilitado: false,
});

function perfilNuevo(uid: string, extra: Record<string, unknown> = {}) {
  return {
    uid,
    nombre: 'Karla',
    apellidos: 'Morales',
    email: `${uid}@test.com`,
    rol: 'seguridad',
    cdId: '5184',
    estado: 'pendiente',
    proveedor: 'correo',
    deviceId: null,
    firma: firmaNueva(),
    consentimientoUbicacion: true,
    creadoEn: serverTimestamp(),
    ...extra,
  };
}

describe('Usuarios · registro', () => {
  it('una cuenta nueva queda pendiente como Seguridad', async () => {
    const db = como(env, 'nuevo').firestore();
    await assertSucceeds(setDoc(doc(db, 'users/nuevo'), perfilNuevo('nuevo')));
  });

  it('no puede registrarse como admin ni activarse sola', async () => {
    const db = como(env, 'nuevo').firestore();
    await assertFails(setDoc(doc(db, 'users/nuevo'), perfilNuevo('nuevo', { rol: 'admin' })));
    await assertFails(setDoc(doc(db, 'users/nuevo'), perfilNuevo('nuevo', { estado: 'activo' })));
  });

  it('exige la firma y el consentimiento de ubicación', async () => {
    const db = como(env, 'nuevo').firestore();
    await assertFails(setDoc(doc(db, 'users/nuevo'), perfilNuevo('nuevo', { firma: null })));
    await assertFails(
      setDoc(doc(db, 'users/nuevo'), perfilNuevo('nuevo', { consentimientoUbicacion: false })),
    );
  });

  it('no puede crear el perfil de otro uid ni con otro correo', async () => {
    const db = como(env, 'nuevo').firestore();
    await assertFails(setDoc(doc(db, 'users/otro'), perfilNuevo('otro')));
    await assertFails(setDoc(doc(db, 'users/nuevo'), perfilNuevo('nuevo', { email: 'x@y.com' })));
  });

  it('el CD debe existir', async () => {
    const db = como(env, 'nuevo').firestore();
    await assertFails(setDoc(doc(db, 'users/nuevo'), perfilNuevo('nuevo', { cdId: '9999' })));
  });

  it('con invitación y correo verificado entra activo con el rol invitado', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'invitaciones/kiosco@test.com'), {
        email: 'kiosco@test.com',
        nombre: 'Kiosco',
        apellidos: 'Garita',
        rol: 'kiosco',
        cdId: '5184',
        creadoPor: 'admin',
        creadoEn: Timestamp.now(),
      });
    });
    const db = como(env, 'k', { email: 'kiosco@test.com', email_verified: true }).firestore();
    const b = writeBatch(db);
    b.set(
      doc(db, 'users/k'),
      perfilNuevo('k', { email: 'kiosco@test.com', rol: 'kiosco', estado: 'activo', firma: null }),
    );
    b.delete(doc(db, 'invitaciones/kiosco@test.com'));
    await assertSucceeds(b.commit());
  });

  it('con invitación pero correo SIN verificar no se activa', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'invitaciones/pa@test.com'), {
        email: 'pa@test.com',
        nombre: 'P',
        apellidos: 'A',
        rol: 'pa',
        cdId: '5184',
        creadoPor: 'admin',
        creadoEn: Timestamp.now(),
      });
    });
    const db = como(env, 'p', { email: 'pa@test.com', email_verified: false }).firestore();
    await assertFails(
      setDoc(doc(db, 'users/p'), perfilNuevo('p', { email: 'pa@test.com', rol: 'pa', estado: 'activo' })),
    );
  });
});

describe('Usuarios · edición propia', () => {
  it('no puede cambiarse rol, estado ni CD', async () => {
    const db = como(env, 'g1').firestore();
    await assertFails(updateDoc(doc(db, 'users/g1'), { rol: 'admin' }));
    await assertFails(updateDoc(doc(db, 'users/g1'), { estado: 'activo', cdId: '7417' }));
    await assertFails(updateDoc(doc(db, 'users/gpend'), { estado: 'activo' }));
  });

  it('puede cambiar su nombre', async () => {
    await assertSucceeds(updateDoc(doc(como(env, 'g1').firestore(), 'users/g1'), { nombre: 'Carlos' }));
  });

  it('un usuario bloqueado no puede editar su perfil', async () => {
    await assertFails(updateDoc(doc(como(env, 'gbloq').firestore(), 'users/gbloq'), { nombre: 'X' }));
  });

  it('vincula su primer dispositivo, pero no puede cambiarlo solo', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users/g2'), { deviceId: null });
    });
    const db = como(env, 'g2').firestore();
    await assertSucceeds(updateDoc(doc(db, 'users/g2'), { deviceId: 'tel-1' }));
    await assertFails(updateDoc(doc(db, 'users/g2'), { deviceId: 'tel-2' }));
    await assertSucceeds(updateDoc(doc(db, 'users/g2'), { deviceIdPendiente: 'tel-2' }));
  });
});

describe('Usuarios · firma', () => {
  it('puede cambiarla si pasaron los días configurados', async () => {
    // La firma sembrada tiene 40 días y el plazo es 30.
    await assertSucceeds(updateDoc(doc(como(env, 'g1').firestore(), 'users/g1'), { firma: firmaNueva() }));
  });

  it('NO puede cambiarla antes del plazo', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users/g1'), {
        'firma.actualizadaEn': Timestamp.fromMillis(Date.now() - 5 * 86400000),
      });
    });
    await assertFails(updateDoc(doc(como(env, 'g1').firestore(), 'users/g1'), { firma: firmaNueva() }));
  });

  it('puede cambiarla antes del plazo si el admin la habilitó, y vuelve a bloquearse', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users/g1'), {
        'firma.actualizadaEn': Timestamp.fromMillis(Date.now() - 5 * 86400000),
        'firma.cambioHabilitado': true,
      });
    });
    const db = como(env, 'g1').firestore();
    await assertFails(updateDoc(doc(db, 'users/g1'), { firma: { ...firmaNueva(), cambioHabilitado: true } }));
    await assertSucceeds(updateDoc(doc(db, 'users/g1'), { firma: firmaNueva() }));
    await assertFails(updateDoc(doc(db, 'users/g1'), { firma: firmaNueva() }));
  });

  it('debe usar la hora del servidor', async () => {
    await assertFails(
      updateDoc(doc(como(env, 'g1').firestore(), 'users/g1'), {
        firma: { ...firmaNueva(), actualizadaEn: Timestamp.fromMillis(Date.now() - 90 * 86400000) },
      }),
    );
  });

  it('el admin habilita el cambio, pero no puede reemplazar el dibujo', async () => {
    const db = como(env, 'admin').firestore();
    await assertSucceeds(updateDoc(doc(db, 'users/g1'), { 'firma.cambioHabilitado': true }));
    await assertFails(updateDoc(doc(db, 'users/g1'), { 'firma.svg': '<svg>otra cosa que no firmó</svg>' }));
  });
});

describe('Usuarios · lectura y administración', () => {
  it('el guardia solo lee su perfil', async () => {
    const db = como(env, 'g1').firestore();
    await assertSucceeds(getDoc(doc(db, 'users/g1')));
    await assertFails(getDoc(doc(db, 'users/g2')));
  });

  it('el PA lee los usuarios de su CD', async () => {
    const db = como(env, 'pa5184').firestore();
    await assertSucceeds(getDoc(doc(db, 'users/g1')));
    await assertFails(getDoc(doc(db, 'users/g7417')));
  });

  it('el PA no edita usuarios', async () => {
    await assertFails(updateDoc(doc(como(env, 'pa5184').firestore(), 'users/gpend'), { estado: 'activo' }));
  });

  it('el admin aprueba, cambia rol y bloquea', async () => {
    const db = como(env, 'admin').firestore();
    await assertSucceeds(updateDoc(doc(db, 'users/gpend'), { estado: 'activo' }));
    await assertSucceeds(updateDoc(doc(db, 'users/g2'), { rol: 'pa' }));
    await assertSucceeds(updateDoc(doc(db, 'users/g1'), { estado: 'bloqueado' }));
    await assertFails(updateDoc(doc(db, 'users/g1'), { rol: 'superadmin' }));
  });

  it('el admin elimina usuarios pero no a sí mismo', async () => {
    const db = como(env, 'admin').firestore();
    await assertSucceeds(deleteDoc(doc(db, 'users/gpend')));
    await assertFails(deleteDoc(doc(db, 'users/admin')));
  });

  it('solo el admin crea invitaciones', async () => {
    const inv = (by: string) => ({
      email: 'x@test.com',
      nombre: 'X',
      apellidos: 'Y',
      rol: 'pa',
      cdId: '5184',
      creadoPor: by,
      creadoEn: serverTimestamp(),
    });
    await assertSucceeds(
      setDoc(doc(como(env, 'admin').firestore(), 'invitaciones/x@test.com'), inv('admin')),
    );
    await assertFails(
      setDoc(doc(como(env, 'pa5184').firestore(), 'invitaciones/y@test.com'), {
        ...inv('pa5184'),
        email: 'y@test.com',
      }),
    );
  });
});
