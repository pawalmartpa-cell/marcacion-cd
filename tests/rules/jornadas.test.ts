import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  Timestamp,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { alertaNueva, bitacoraNueva, como, crearEntorno, jornadaNueva, marca, sembrar } from './helpers';

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

async function sembrarJornada(id: string, datos: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'jornadas', id), datos);
  });
}

function jornadaGuardada(uid = 'g1', extra: Record<string, unknown> = {}) {
  const j = jornadaNueva(uid);
  const t = Timestamp.now();
  return {
    ...j,
    entrada: { ...j.entrada, horaServidor: t },
    creadoEn: t,
    ...extra,
  };
}

describe('Jornadas · entrada del guardia', () => {
  it('crea su entrada válida con GPS dentro de 150 m', async () => {
    const db = como(env, 'g1').firestore();
    await assertSucceeds(setDoc(doc(db, 'jornadas/j1'), jornadaNueva('g1')));
  });

  it('NO puede usar la hora del celular como hora del servidor', async () => {
    const db = como(env, 'g1').firestore();
    const falsa = Timestamp.fromMillis(Date.now() - 2 * 3600 * 1000);
    await assertFails(setDoc(doc(db, 'jornadas/j1'), jornadaNueva('g1', { horaServidor: falsa })));
  });

  it('NO puede marcar por otro usuario', async () => {
    const db = como(env, 'g1').firestore();
    await assertFails(setDoc(doc(db, 'jornadas/j1'), jornadaNueva('g2', {}, { nombre: 'Nombre g2' })));
  });

  it('NO puede marcar para otro CD', async () => {
    const db = como(env, 'g1').firestore();
    await assertFails(setDoc(doc(db, 'jornadas/j1'), jornadaNueva('g1', {}, { cdId: '7417' })));
  });

  it('NO puede marcar si está pendiente o bloqueado', async () => {
    await assertFails(setDoc(doc(como(env, 'gpend').firestore(), 'jornadas/j1'), jornadaNueva('gpend')));
    await assertFails(setDoc(doc(como(env, 'gbloq').firestore(), 'jornadas/j2'), jornadaNueva('gbloq')));
  });

  it('PA, admin y kiosco no crean jornadas como guardia', async () => {
    await assertFails(setDoc(doc(como(env, 'pa5184').firestore(), 'jornadas/j1'), jornadaNueva('pa5184')));
    await assertFails(
      setDoc(doc(como(env, 'kiosco5184').firestore(), 'jornadas/j2'), jornadaNueva('kiosco5184')),
    );
  });

  it('NO puede declarar zona válida estando a 500 m', async () => {
    const db = como(env, 'g1').firestore();
    await assertFails(setDoc(doc(db, 'jornadas/j1'), jornadaNueva('g1', { metros: 500, zona: 'valida' })));
  });

  it('NO puede mentir sobre la distancia', async () => {
    const db = como(env, 'g1').firestore();
    await assertFails(
      setDoc(
        doc(db, 'jornadas/j1'),
        jornadaNueva('g1', { metros: 500, zona: 'valida', distanciaDeclarada: 40 }),
      ),
    );
  });

  it('a 500 m se acepta con zona observación', async () => {
    const db = como(env, 'g1').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'jornadas/j1'), jornadaNueva('g1', { metros: 500, zona: 'observacion' })),
    );
  });

  it('a más de 1 km exige crear la alerta en el mismo lote', async () => {
    const db = como(env, 'g1').firestore();
    await assertFails(setDoc(doc(db, 'jornadas/j1'), jornadaNueva('g1', { metros: 2000, zona: 'alerta' })));
    const b = writeBatch(db);
    b.set(doc(db, 'jornadas/j2'), jornadaNueva('g1', { metros: 2000, zona: 'alerta' }));
    b.set(doc(db, 'alertas/j2_entrada'), alertaNueva('j2', 'entrada'));
    await assertSucceeds(b.commit());
  });

  it('la fecha debe ser la de hoy en El Salvador', async () => {
    const db = como(env, 'g1').firestore();
    await assertFails(setDoc(doc(db, 'jornadas/j1'), jornadaNueva('g1', {}, { fecha: '2020-01-01' })));
  });

  it('el turno debe ser uno de los del CD', async () => {
    const db = como(env, 'g1').firestore();
    await assertFails(
      setDoc(
        doc(db, 'jornadas/j1'),
        jornadaNueva('g1', {}, { turno: { nombre: 'Diurno', inicio: '08:00', fin: '14:00' } }),
      ),
    );
  });

  it('dispositivoDistinto debe decir la verdad', async () => {
    const db = como(env, 'g1').firestore();
    await assertFails(
      setDoc(
        doc(db, 'jornadas/j1'),
        jornadaNueva('g1', { deviceId: 'otro-telefono', dispositivoDistinto: false }),
      ),
    );
    await assertSucceeds(
      setDoc(
        doc(db, 'jornadas/j2'),
        jornadaNueva('g1', { deviceId: 'otro-telefono', dispositivoDistinto: true }),
      ),
    );
  });

  it('la hora del teléfono no puede estar en el futuro', async () => {
    const db = como(env, 'g1').firestore();
    const futuro = Timestamp.fromMillis(Date.now() + 60 * 60 * 1000);
    await assertFails(setDoc(doc(db, 'jornadas/j1'), jornadaNueva('g1', { horaDispositivo: futuro })));
  });

  it('marca sin conexión (hora del teléfono anterior) se acepta y queda identificada', async () => {
    const db = como(env, 'g1').firestore();
    const antes = Timestamp.fromMillis(Date.now() - 20 * 60 * 1000);
    await assertSucceeds(
      setDoc(doc(db, 'jornadas/j1'), jornadaNueva('g1', { horaDispositivo: antes, offline: true })),
    );
  });
});

describe('Jornadas · salida del guardia', () => {
  it('agrega su salida una sola vez', async () => {
    await sembrarJornada('j1', jornadaGuardada('g1'));
    const db = como(env, 'g1').firestore();
    await assertSucceeds(updateDoc(doc(db, 'jornadas/j1'), { salida: marca(), estado: 'cerrada' }));
    await assertFails(updateDoc(doc(db, 'jornadas/j1'), { salida: marca(), estado: 'cerrada' }));
  });

  it('NO puede modificar la entrada', async () => {
    await sembrarJornada('j1', jornadaGuardada('g1'));
    const db = como(env, 'g1').firestore();
    await assertFails(
      updateDoc(doc(db, 'jornadas/j1'), {
        salida: marca(),
        estado: 'cerrada',
        'entrada.zona': 'observacion',
      }),
    );
    await assertFails(updateDoc(doc(db, 'jornadas/j1'), { fecha: '2026-01-01' }));
  });

  it('NO puede agregar la salida de otro guardia', async () => {
    await sembrarJornada('j1', jornadaGuardada('g2', { nombre: 'Nombre g2' }));
    const db = como(env, 'g1').firestore();
    await assertFails(updateDoc(doc(db, 'jornadas/j1'), { salida: marca(), estado: 'cerrada' }));
  });

  it('turno nocturno: la salida del día siguiente queda en la misma jornada y conserva la fecha', async () => {
    // Entrada ayer 22:00 (hace 8 h); la salida hoy se agrega a la misma jornada.
    const hace8h = Timestamp.fromMillis(Date.now() - 8 * 3600 * 1000);
    const j = jornadaGuardada('g1', { fecha: '2026-11-09' });
    await sembrarJornada('noche', {
      ...j,
      entrada: { ...j.entrada, horaServidor: hace8h, horaDispositivo: hace8h },
    });
    const db = como(env, 'g1').firestore();
    await assertSucceeds(updateDoc(doc(db, 'jornadas/noche'), { salida: marca(), estado: 'cerrada' }));
    const snap = await getDoc(doc(db, 'jornadas/noche'));
    if (snap.data()?.fecha !== '2026-11-09') throw new Error('La fecha cambió');
  });

  it('salida fuera de 1 km exige su alerta', async () => {
    await sembrarJornada('j1', jornadaGuardada('g1'));
    const db = como(env, 'g1').firestore();
    await assertFails(
      updateDoc(doc(db, 'jornadas/j1'), {
        salida: marca({ metros: 1500, zona: 'alerta' }),
        estado: 'cerrada',
      }),
    );
    const b = writeBatch(db);
    b.update(doc(db, 'jornadas/j1'), { salida: marca({ metros: 1500, zona: 'alerta' }), estado: 'cerrada' });
    b.set(doc(db, 'alertas/j1_salida'), alertaNueva('j1', 'salida'));
    await assertSucceeds(b.commit());
  });
});

describe('Jornadas · lectura', () => {
  beforeEach(async () => {
    await sembrarJornada('propia', jornadaGuardada('g1'));
    await sembrarJornada('ajena', jornadaGuardada('g2', { nombre: 'Nombre g2' }));
    await sembrarJornada('otrocd', jornadaGuardada('g7417', { cdId: '7417', nombre: 'Nombre g7417' }));
  });

  it('el guardia lee las suyas pero no las de otros', async () => {
    const db = como(env, 'g1').firestore();
    await assertSucceeds(getDoc(doc(db, 'jornadas/propia')));
    await assertFails(getDoc(doc(db, 'jornadas/ajena')));
    await assertSucceeds(getDocs(query(collection(db, 'jornadas'), where('uid', '==', 'g1'))));
    await assertFails(getDocs(collection(db, 'jornadas')));
  });

  it('el PA lee solo su CD', async () => {
    const db = como(env, 'pa5184').firestore();
    await assertSucceeds(getDoc(doc(db, 'jornadas/ajena')));
    await assertFails(getDoc(doc(db, 'jornadas/otrocd')));
    await assertSucceeds(getDocs(query(collection(db, 'jornadas'), where('cdId', '==', '5184'))));
    await assertFails(getDocs(query(collection(db, 'jornadas'), where('cdId', '==', '7417'))));
    // Detalle de un guardia: con su CD funciona; solo por uid, no.
    await assertSucceeds(
      getDocs(query(collection(db, 'jornadas'), where('cdId', '==', '5184'), where('uid', '==', 'g2'))),
    );
    await assertFails(getDocs(query(collection(db, 'jornadas'), where('uid', '==', 'g2'))));
  });

  it('el admin lee todo', async () => {
    const db = como(env, 'admin').firestore();
    await assertSucceeds(getDocs(collection(db, 'jornadas')));
  });

  it('un guardia bloqueado no lee ni sus jornadas', async () => {
    await sembrarJornada('bloq', jornadaGuardada('gbloq', { nombre: 'Nombre gbloq' }));
    await assertFails(getDoc(doc(como(env, 'gbloq').firestore(), 'jornadas/bloq')));
  });
});

describe('Jornadas · corrección del admin', () => {
  beforeEach(async () => {
    await sembrarJornada('j1', jornadaGuardada('g1'));
  });

  it('sin bitácora en el mismo lote, falla', async () => {
    const db = como(env, 'admin').firestore();
    await assertFails(
      updateDoc(doc(db, 'jornadas/j1'), {
        salida: marca(),
        estado: 'cerrada',
        editada: true,
        ultimaEdicionId: 'log1',
      }),
    );
  });

  it('con bitácora y motivo en el mismo lote, funciona', async () => {
    const db = como(env, 'admin').firestore();
    const b = writeBatch(db);
    b.update(doc(db, 'jornadas/j1'), {
      salida: { ...marca(), metodo: 'admin', horaServidor: Timestamp.now() },
      estado: 'cerrada',
      editada: true,
      ultimaEdicionId: 'log1',
    });
    b.set(doc(db, 'bitacora/log1'), bitacoraNueva('admin', 'admin', 'j1'));
    await assertSucceeds(b.commit());
  });

  it('sin motivo, falla', async () => {
    const db = como(env, 'admin').firestore();
    const b = writeBatch(db);
    b.update(doc(db, 'jornadas/j1'), {
      salida: marca(),
      estado: 'cerrada',
      editada: true,
      ultimaEdicionId: 'log1',
    });
    b.set(doc(db, 'bitacora/log1'), bitacoraNueva('admin', 'admin', 'j1', { motivo: '' }));
    await assertFails(b.commit());
  });

  it('la bitácora debe referirse a esta jornada', async () => {
    const db = como(env, 'admin').firestore();
    const b = writeBatch(db);
    b.update(doc(db, 'jornadas/j1'), {
      salida: marca(),
      estado: 'cerrada',
      editada: true,
      ultimaEdicionId: 'log1',
    });
    b.set(doc(db, 'bitacora/log1'), bitacoraNueva('admin', 'admin', 'otra'));
    await assertFails(b.commit());
  });

  it('el PA NO puede corregir horas', async () => {
    const db = como(env, 'pa5184').firestore();
    const b = writeBatch(db);
    b.update(doc(db, 'jornadas/j1'), {
      salida: marca(),
      estado: 'cerrada',
      editada: true,
      ultimaEdicionId: 'log1',
    });
    b.set(doc(db, 'bitacora/log1'), bitacoraNueva('pa5184', 'pa', 'j1'));
    await assertFails(b.commit());
  });

  it('el admin crea una jornada completa (olvido) con bitácora', async () => {
    const db = como(env, 'admin').firestore();
    const b = writeBatch(db);
    const t = Timestamp.now();
    b.set(doc(db, 'jornadas/nueva'), {
      ...jornadaNueva('g1'),
      entrada: { ...marca(), metodo: 'admin', horaServidor: t },
      salida: { ...marca(), metodo: 'admin', horaServidor: t },
      estado: 'cerrada',
      editada: true,
      ultimaEdicionId: 'log2',
      creadoEn: serverTimestamp(),
    });
    b.set(doc(db, 'bitacora/log2'), bitacoraNueva('admin', 'admin', 'nueva'));
    await assertSucceeds(b.commit());
  });

  it('nadie borra jornadas desde la app', async () => {
    const { deleteDoc } = await import('firebase/firestore');
    await assertFails(deleteDoc(doc(como(env, 'admin').firestore(), 'jornadas/j1')));
  });
});

describe('Jornadas · marca con QR del kiosco', () => {
  it('token vigente: se acepta', async () => {
    const db = como(env, 'g1').firestore();
    await assertSucceeds(setDoc(doc(db, 'jornadas/q1'), jornadaNueva('g1', { metodo: 'qr' })));
  });

  it('token inexistente o vencido: falla', async () => {
    const db = como(env, 'g1').firestore();
    await assertFails(
      setDoc(doc(db, 'jornadas/q1'), jornadaNueva('g1', { metodo: 'qr', qrToken: 'INVENTADO' })),
    );
    await assertFails(
      setDoc(doc(db, 'jornadas/q2'), jornadaNueva('g1', { metodo: 'qr', qrToken: 'TOKENVIEJO' })),
    );
  });

  it('CD con QR deshabilitado: falla', async () => {
    const db = como(env, 'g7417').firestore();
    await assertFails(
      setDoc(
        doc(db, 'jornadas/q1'),
        jornadaNueva('g7417', { metodo: 'qr' }, { cdId: '7417', nombre: 'Nombre g7417' }),
      ),
    );
  });

  it('el guardia NO puede leer los tokens del kiosco', async () => {
    await assertFails(getDoc(doc(como(env, 'g1').firestore(), 'kioscos/5184')));
  });
});
