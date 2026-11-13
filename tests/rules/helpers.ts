import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { GeoPoint, Timestamp, doc, serverTimestamp, setDoc, setLogLevel } from 'firebase/firestore';

export const PROJECT = 'demo-marcacion';
export const CD = { lat: 13.6731, lng: -89.2794 };
export const TURNOS = [
  { nombre: 'Diurno', inicio: '06:00', fin: '14:00' },
  { nombre: 'Vespertino', inicio: '14:00', fin: '22:00' },
  { nombre: 'Nocturno', inicio: '22:00', fin: '06:00' },
];

/** Distancia (m) igual a la que calcula la app. */
export function distanciaM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371008.8;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Punto al norte del CD a `m` metros. */
export function puntoA(m: number) {
  const lat = CD.lat + m / 111195;
  return { lat, lng: CD.lng, d: distanciaM(CD.lat, CD.lng, lat, CD.lng) };
}

export function fechaSV(d = new Date()): string {
  return new Date(d.getTime() - 6 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function crearEntorno(): Promise<RulesTestEnvironment> {
  setLogLevel('silent');
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
  return initializeTestEnvironment({
    projectId: PROJECT,
    firestore: {
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      host,
      port: Number(port),
    },
  });
}

const FIRMA_VIEJA = () => ({
  tipo: 'generada',
  svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>Firma</text></svg>',
  fuente: 'Great Vibes',
  actualizadaEn: Timestamp.fromMillis(Date.now() - 40 * 86400 * 1000),
  cambioHabilitado: false,
});

export function usuarioBase(uid: string, extra: Record<string, unknown> = {}) {
  return {
    uid,
    nombre: 'Nombre',
    apellidos: uid,
    email: `${uid}@test.com`,
    rol: 'seguridad',
    cdId: '5184',
    estado: 'activo',
    proveedor: 'correo',
    deviceId: 'dev-' + uid,
    deviceIdPendiente: null,
    firma: FIRMA_VIEJA(),
    consentimientoUbicacion: true,
    creadoEn: Timestamp.now(),
    ...extra,
  };
}

export function cdBase(codigo: string, extra: Record<string, unknown> = {}) {
  return {
    nombre: 'CD ' + codigo,
    codigo,
    ubicacion: new GeoPoint(CD.lat, CD.lng),
    radioValido: 150,
    radioAlerta: 1000,
    turnos: TURNOS,
    toleranciaMin: 10,
    qrHabilitado: true,
    qrRotacionSeg: 30,
    paUids: [],
    kioscoEmail: null,
    ...extra,
  };
}

/** Datos semilla mínimos para las pruebas. */
export async function sembrar(env: RulesTestEnvironment) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'cds/5184'), cdBase('5184'));
    await setDoc(doc(db, 'cds/7417'), cdBase('7417', { qrHabilitado: false }));
    await setDoc(doc(db, 'users/admin'), usuarioBase('admin', { rol: 'admin', firma: null }));
    await setDoc(doc(db, 'users/pa5184'), usuarioBase('pa5184', { rol: 'pa', firma: null }));
    await setDoc(doc(db, 'users/pa7417'), usuarioBase('pa7417', { rol: 'pa', cdId: '7417', firma: null }));
    await setDoc(doc(db, 'users/g1'), usuarioBase('g1'));
    await setDoc(doc(db, 'users/g2'), usuarioBase('g2'));
    await setDoc(doc(db, 'users/g7417'), usuarioBase('g7417', { cdId: '7417' }));
    await setDoc(doc(db, 'users/gpend'), usuarioBase('gpend', { estado: 'pendiente' }));
    await setDoc(doc(db, 'users/gbloq'), usuarioBase('gbloq', { estado: 'bloqueado' }));
    await setDoc(doc(db, 'users/kiosco5184'), usuarioBase('kiosco5184', { rol: 'kiosco', firma: null }));
    await setDoc(
      doc(db, 'users/kiosco7417'),
      usuarioBase('kiosco7417', { rol: 'kiosco', cdId: '7417', firma: null }),
    );
    const ahora = Date.now();
    await setDoc(doc(db, 'kioscos/5184'), {
      cdId: '5184',
      rotSeg: 30,
      actualizadoEn: Timestamp.now(),
      tokens: {
        TOKENACTUAL: {
          desde: Timestamp.fromMillis(ahora - 15000),
          hasta: Timestamp.fromMillis(ahora + 15000),
        },
        TOKENVIEJO: {
          desde: Timestamp.fromMillis(ahora - 600000),
          hasta: Timestamp.fromMillis(ahora - 570000),
        },
      },
    });
    await setDoc(doc(db, 'config/general'), {
      diasRetencion: 90,
      diasCambioFirma: 30,
      nombreApp: 'Marcación CD',
      tema: 'auto',
    });
  });
}

export function como(
  env: RulesTestEnvironment,
  uid: string,
  token: Record<string, unknown> = {},
): RulesTestContext {
  return env.authenticatedContext(uid, { email: `${uid}@test.com`, email_verified: true, ...token });
}

export interface OpcionesMarca {
  metros?: number;
  zona?: 'valida' | 'observacion' | 'alerta';
  distanciaDeclarada?: number;
  horaServidor?: unknown;
  horaDispositivo?: Timestamp;
  deviceId?: string;
  dispositivoDistinto?: boolean;
  metodo?: 'gps' | 'qr';
  qrToken?: string | null;
  offline?: boolean;
}

export function marca(o: OpcionesMarca = {}, uid = 'g1') {
  if (o.metodo === 'qr') {
    return {
      horaServidor: o.horaServidor ?? serverTimestamp(),
      horaDispositivo: o.horaDispositivo ?? Timestamp.now(),
      metodo: 'qr',
      lat: null,
      lng: null,
      precision: null,
      distanciaM: null,
      zona: 'valida',
      offline: o.offline ?? false,
      deviceId: o.deviceId ?? 'dev-' + uid,
      dispositivoDistinto: o.dispositivoDistinto ?? false,
      qrToken: o.qrToken ?? 'TOKENACTUAL',
    };
  }
  const p = puntoA(o.metros ?? 30);
  return {
    horaServidor: o.horaServidor ?? serverTimestamp(),
    horaDispositivo: o.horaDispositivo ?? Timestamp.now(),
    metodo: 'gps',
    lat: p.lat,
    lng: p.lng,
    precision: 12,
    distanciaM: o.distanciaDeclarada ?? Math.round(p.d),
    zona: o.zona ?? 'valida',
    offline: o.offline ?? false,
    deviceId: o.deviceId ?? 'dev-' + uid,
    dispositivoDistinto: o.dispositivoDistinto ?? false,
    qrToken: null,
  };
}

export function jornadaNueva(uid = 'g1', o: OpcionesMarca = {}, extra: Record<string, unknown> = {}) {
  return {
    uid,
    nombre: 'Nombre ' + uid,
    cdId: '5184',
    fecha: fechaSV(),
    turno: TURNOS[0],
    toleranciaMin: 10,
    entrada: marca(o, uid),
    salida: null,
    estado: 'abierta',
    editada: false,
    ultimaEdicionId: null,
    expiraEn: Timestamp.fromMillis(Date.now() + 90 * 86400 * 1000),
    creadoEn: serverTimestamp(),
    ...extra,
  };
}

export function alertaNueva(
  jid: string,
  parte: 'entrada' | 'salida',
  uid = 'g1',
  extra: Record<string, unknown> = {},
) {
  return {
    jornadaId: jid,
    uid,
    nombre: 'Nombre ' + uid,
    cdId: '5184',
    parte,
    tipo: 'fuera_rango',
    severidad: 'alta',
    texto: 'Marca fuera de 1 km',
    distanciaM: 2000,
    estado: 'abierta',
    resueltoPor: null,
    comentario: null,
    creadoEn: serverTimestamp(),
    ...extra,
  };
}

export function bitacoraNueva(
  quien: string,
  rol: string,
  refId: string | null,
  extra: Record<string, unknown> = {},
) {
  return {
    quien,
    quienNombre: 'Nombre ' + quien,
    rol,
    accion: 'corregir_jornada',
    detalle: 'Corrigió la salida',
    motivo: 'Verificado con hoja de papel',
    refTipo: refId ? 'jornada' : null,
    refId,
    cdId: '5184',
    antes: null,
    despues: null,
    fecha: serverTimestamp(),
    ...extra,
  };
}
