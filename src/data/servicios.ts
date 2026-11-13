import {
  GeoPoint,
  Timestamp,
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/lib/firebase';
import { col, ref } from './refs';
import { fechaISO, hora } from '@/lib/fechas';
import { distanciaM, distanciaTexto, zonaPorDistancia, type Lectura } from '@/lib/geo';
import type {
  Alerta,
  Cd,
  ConfigGeneral,
  EstadoAlerta,
  Invitacion,
  Jornada,
  Marca,
  Parte,
  Rol,
  Severidad,
  Solicitud,
  TipoAlerta,
  Turno,
  Usuario,
} from '@/types';
import { nombreCompleto } from '@/auth/AuthProvider';
import type { FirmaBorrador } from '@/components/FirmaEditor';
import { generarLote } from '@/lib/qr';
import { horaEfectiva as horaVista } from '@/lib/jornada';

// ---------------------------------------------------------------- bitácora
export interface Actor {
  uid: string;
  nombre: string;
  rol: Rol;
  cdId: string;
}

export function actorDe(p: Usuario): Actor {
  return { uid: p.uid, nombre: nombreCompleto(p), rol: p.rol, cdId: p.cdId };
}

interface Log {
  accion: string;
  detalle: string;
  motivo?: string | null;
  refTipo?: string | null;
  refId?: string | null;
  cdId?: string | null;
  antes?: unknown;
  despues?: unknown;
}

/** Agrega un registro a la bitácora dentro de un lote. Devuelve su id. */
export function logEnLote(b: WriteBatch, actor: Actor, l: Log): string {
  const r = ref.nuevo('bitacora');
  b.set(r, {
    quien: actor.uid,
    quienNombre: actor.nombre,
    rol: actor.rol,
    accion: l.accion,
    detalle: l.detalle.slice(0, 1000),
    motivo: l.motivo ?? null,
    refTipo: l.refTipo ?? null,
    refId: l.refId ?? null,
    cdId: l.cdId ?? (actor.rol === 'pa' ? actor.cdId : null),
    antes: l.antes ?? null,
    despues: l.despues ?? null,
    fecha: serverTimestamp(),
  });
  return r.id;
}

export async function registrar(actor: Actor, l: Log) {
  const b = writeBatch(db);
  logEnLote(b, actor, l);
  await b.commit();
}

function notifEnLote(
  b: WriteBatch,
  creadoPor: string,
  n: {
    para: 'staff' | 'usuario';
    uid?: string | null;
    cdId: string | null;
    tipo: string;
    texto: string;
    enlace?: string | null;
  },
) {
  b.set(ref.nuevo('notificaciones'), {
    para: n.para,
    uid: n.uid ?? null,
    cdId: n.cdId,
    tipo: n.tipo,
    texto: n.texto.slice(0, 300),
    enlace: n.enlace ?? null,
    creadoPor,
    creadoEn: serverTimestamp(),
    leidaPor: [],
  });
}

// ---------------------------------------------------------------- perfil
export interface DatosPerfil {
  nombre: string;
  apellidos: string;
  cdId: string;
  firma: FirmaBorrador | null;
}

export async function crearPerfil(u: User, d: DatosPerfil, invitacion: Invitacion | null) {
  const email = (u.email ?? '').toLowerCase();
  const proveedor = u.providerData.some((p) => p.providerId === 'google.com') ? 'google' : 'correo';
  const b = writeBatch(db);
  const usarInv = !!invitacion && u.emailVerified;
  const perfil = {
    uid: u.uid,
    nombre: d.nombre.trim(),
    apellidos: d.apellidos.trim(),
    email,
    rol: usarInv ? invitacion.rol : 'seguridad',
    cdId: usarInv ? invitacion.cdId : d.cdId,
    estado: usarInv ? 'activo' : 'pendiente',
    proveedor,
    deviceId: null,
    deviceIdPendiente: null,
    firma: d.firma ? { ...d.firma, actualizadaEn: serverTimestamp(), cambioHabilitado: false } : null,
    consentimientoUbicacion: true,
    creadoEn: serverTimestamp(),
  };
  b.set(ref.user(u.uid), perfil);
  if (usarInv) b.delete(ref.invitacion(email));
  await b.commit();
  if (!usarInv) {
    // Aviso a admins/PA (aparte: si falla, el registro ya quedó hecho).
    const n = writeBatch(db);
    notifEnLote(n, u.uid, {
      para: 'staff',
      cdId: perfil.cdId,
      tipo: 'registro',
      texto: `${perfil.nombre} ${perfil.apellidos} se registró y espera aprobación`,
      enlace: 'usuarios',
    });
    await n.commit().catch((e) => console.warn(e));
  }
}

export async function buscarInvitacion(email: string | null): Promise<Invitacion | null> {
  if (!email) return null;
  try {
    const s = await getDoc(ref.invitacion(email));
    return s.exists() ? (s.data() as Invitacion) : null;
  } catch {
    return null;
  }
}

export async function actualizarNombre(uid: string, nombre: string, apellidos: string) {
  await updateDoc(ref.user(uid), { nombre: nombre.trim(), apellidos: apellidos.trim() });
}

export async function cambiarFirma(p: Usuario, f: FirmaBorrador) {
  const b = writeBatch(db);
  b.update(ref.user(p.uid), { firma: { ...f, actualizadaEn: serverTimestamp(), cambioHabilitado: false } });
  await b.commit();
  const n = writeBatch(db);
  notifEnLote(n, p.uid, {
    para: 'staff',
    cdId: p.cdId,
    tipo: 'firma',
    texto: `${nombreCompleto(p)} cambió su firma`,
    enlace: `guardia/${p.uid}`,
  });
  await n.commit().catch((e) => console.warn(e));
}

export async function vincularDispositivo(p: Usuario, deviceId: string) {
  if (p.deviceId == null) await updateDoc(ref.user(p.uid), { deviceId });
  else if (p.deviceId !== deviceId && p.deviceIdPendiente !== deviceId)
    await updateDoc(ref.user(p.uid), { deviceIdPendiente: deviceId });
}

// ---------------------------------------------------------------- marcación
export interface Marcar {
  perfil: Usuario;
  cd: Cd;
  turno: Turno;
  jornadaAbierta: Jornada | null;
  deviceId: string;
  enLinea: boolean;
  diasRetencion: number;
  lectura?: Lectura;
  qrToken?: string;
}

export interface ResultadoMarca {
  jornadaId: string;
  parte: Parte;
  marca: Omit<Marca, 'horaServidor'>;
  /** Se resuelve cuando el servidor confirma (puede tardar si no hay conexión). */
  sincronizada: Promise<void>;
}

function alertaPara(
  m: Omit<Marca, 'horaServidor'>,
  parte: Parte,
  cd: Cd,
): { tipo: TipoAlerta; severidad: Severidad; texto: string } | null {
  const P = parte === 'entrada' ? 'Entrada' : 'Salida';
  if (m.zona === 'alerta')
    return {
      tipo: 'fuera_rango',
      severidad: 'alta',
      texto: `${P} marcada a ${distanciaTexto(m.distanciaM)} del CD (fuera del límite de ${distanciaTexto(cd.radioAlerta)})`,
    };
  if (m.zona === 'observacion')
    return {
      tipo: 'observacion',
      severidad: 'media',
      texto: `${P} a ${distanciaTexto(m.distanciaM)} (entre ${distanciaTexto(cd.radioValido)} y ${distanciaTexto(cd.radioAlerta)})`,
    };
  if (m.dispositivoDistinto)
    return {
      tipo: 'dispositivo',
      severidad: 'media',
      texto: `${P} marcada desde un teléfono distinto al registrado`,
    };
  if (m.offline)
    return {
      tipo: 'sin_conexion',
      severidad: 'info',
      texto: `Marca sin conexión: hora del celular ${hora(m.horaDispositivo)}`,
    };
  return null;
}

/**
 * Registra la entrada o la salida. Con persistencia offline el cambio se guarda en el teléfono al
 * instante y se envía al servidor al reconectar: por eso NO se espera el commit.
 */
export function marcar(o: Marcar): ResultadoMarca {
  const { perfil, cd, turno } = o;
  const parte: Parte = o.jornadaAbierta ? 'salida' : 'entrada';
  const ahora = new Date();
  let m: Omit<Marca, 'horaServidor'>;
  if (o.qrToken) {
    m = {
      horaDispositivo: Timestamp.fromDate(ahora),
      metodo: 'qr',
      lat: null,
      lng: null,
      precision: null,
      distanciaM: null,
      zona: 'valida',
      offline: false,
      deviceId: o.deviceId,
      dispositivoDistinto: perfil.deviceId != null && perfil.deviceId !== o.deviceId,
      qrToken: o.qrToken,
    };
  } else {
    const l = o.lectura!;
    const d = Math.round(distanciaM(cd.ubicacion.latitude, cd.ubicacion.longitude, l.lat, l.lng));
    m = {
      horaDispositivo: Timestamp.fromDate(ahora),
      metodo: 'gps',
      lat: l.lat,
      lng: l.lng,
      precision: l.precision,
      distanciaM: d,
      zona: zonaPorDistancia(d, cd.radioValido, cd.radioAlerta),
      offline: !o.enLinea,
      deviceId: o.deviceId,
      dispositivoDistinto: perfil.deviceId != null && perfil.deviceId !== o.deviceId,
      qrToken: null,
    };
  }
  const marca = { ...m, horaServidor: serverTimestamp() };
  const b = writeBatch(db);
  let jornadaId: string;
  if (parte === 'entrada') {
    const r = ref.nuevo('jornadas');
    jornadaId = r.id;
    b.set(r, {
      uid: perfil.uid,
      nombre: nombreCompleto(perfil),
      cdId: perfil.cdId,
      fecha: fechaISO(ahora),
      turno: { nombre: turno.nombre, inicio: turno.inicio, fin: turno.fin },
      toleranciaMin: cd.toleranciaMin,
      entrada: marca,
      salida: null,
      estado: 'abierta',
      editada: false,
      ultimaEdicionId: null,
      expiraEn: Timestamp.fromMillis(ahora.getTime() + o.diasRetencion * 86400000),
      creadoEn: serverTimestamp(),
    });
  } else {
    jornadaId = o.jornadaAbierta!.id;
    b.update(ref.jornada(jornadaId), { salida: marca, estado: 'cerrada' });
  }
  const al = alertaPara(m, parte, cd);
  if (al) {
    b.set(ref.alerta(`${jornadaId}_${parte}`), {
      jornadaId,
      uid: perfil.uid,
      nombre: nombreCompleto(perfil),
      cdId: perfil.cdId,
      parte,
      tipo: al.tipo,
      severidad: al.severidad,
      texto: al.texto,
      distanciaM: m.distanciaM,
      estado: 'abierta',
      resueltoPor: null,
      comentario: null,
      creadoEn: serverTimestamp(),
    });
  }
  const sincronizada = b.commit();
  return { jornadaId, parte, marca: m, sincronizada };
}

// ---------------------------------------------------------------- admin: jornadas
function marcaAdmin(fechaHora: Date, base: Marca | null, deviceId: string): Marca {
  return {
    horaServidor: Timestamp.fromDate(fechaHora),
    horaDispositivo: Timestamp.fromDate(fechaHora),
    metodo: 'admin',
    lat: base?.lat ?? null,
    lng: base?.lng ?? null,
    precision: base?.precision ?? null,
    distanciaM: base?.distanciaM ?? null,
    zona: 'valida',
    offline: false,
    deviceId: base?.deviceId ?? deviceId,
    dispositivoDistinto: false,
    qrToken: null,
  };
}

export interface Correccion {
  entrada: Date | null;
  salida: Date | null;
  motivo: string;
  alertasAbiertas: Alerta[];
}

/** Corrige una jornada en un solo lote con su bitácora; cierra las alertas abiertas de la jornada. */
export async function corregirJornada(actor: Actor, j: Jornada, c: Correccion): Promise<string[]> {
  const cambiosTxt: string[] = [];
  const upd: Record<string, unknown> = {};
  const antes: Record<string, string> = {};
  const despues: Record<string, string> = {};
  const hEnt = hora(horaVista(j.entrada));
  if (c.entrada && hora(c.entrada) !== hora(horaVista(j.entrada))) {
    upd.entrada = marcaAdmin(c.entrada, j.entrada, j.entrada.deviceId);
    if (!j.entradaOriginal) upd.entradaOriginal = j.entrada;
    cambiosTxt.push(`entrada ${hora(horaVista(j.entrada))} → ${hora(c.entrada)}`);
    antes.entrada = hEnt;
    despues.entrada = hora(c.entrada);
  }
  const salidaActual = j.salida ? hora(horaVista(j.salida)) : '—';
  if (c.salida && hora(c.salida) !== salidaActual) {
    upd.salida = marcaAdmin(c.salida, j.salida, j.entrada.deviceId);
    upd.estado = 'cerrada';
    if (j.salida && !j.salidaOriginal) upd.salidaOriginal = j.salida;
    cambiosTxt.push(`salida ${salidaActual} → ${hora(c.salida)}`);
    antes.salida = salidaActual;
    despues.salida = hora(c.salida);
  }
  if (!cambiosTxt.length) return [];
  const b = writeBatch(db);
  const logId = logEnLote(b, actor, {
    accion: 'corregir_jornada',
    detalle: `Corrigió la jornada de ${j.nombre} del ${j.fecha.split('-').reverse().join('/')}: ${cambiosTxt.join(', ')}`,
    motivo: c.motivo,
    refTipo: 'jornada',
    refId: j.id,
    cdId: j.cdId,
    antes,
    despues,
  });
  b.update(ref.jornada(j.id), { ...upd, editada: true, ultimaEdicionId: logId });
  for (const a of c.alertasAbiertas) {
    b.update(ref.alerta(a.id), {
      estado: 'aceptada',
      resueltoPor: actor.uid,
      resueltoNombre: actor.nombre,
      comentario: `Jornada corregida: ${c.motivo}`.slice(0, 500),
      resueltoEn: serverTimestamp(),
    });
  }
  await b.commit();
  return cambiosTxt;
}

/** El admin crea una jornada completa (p. ej. el guardia olvidó marcar). */
export async function crearJornadaAdmin(
  actor: Actor,
  g: Usuario,
  cd: Cd,
  datos: {
    fecha: string;
    turno: Turno;
    entrada: Date;
    salida: Date | null;
    motivo: string;
    diasRetencion: number;
  },
) {
  const b = writeBatch(db);
  const r = ref.nuevo('jornadas');
  const logId = logEnLote(b, actor, {
    accion: 'crear_jornada',
    detalle: `Agregó una jornada para ${nombreCompleto(g)} del ${datos.fecha.split('-').reverse().join('/')}: entrada ${hora(datos.entrada)}${datos.salida ? `, salida ${hora(datos.salida)}` : ''}`,
    motivo: datos.motivo,
    refTipo: 'jornada',
    refId: r.id,
    cdId: g.cdId,
  });
  b.set(r, {
    uid: g.uid,
    nombre: nombreCompleto(g),
    cdId: g.cdId,
    fecha: datos.fecha,
    turno: datos.turno,
    toleranciaMin: cd.toleranciaMin,
    entrada: marcaAdmin(datos.entrada, null, 'admin'),
    salida: datos.salida ? marcaAdmin(datos.salida, null, 'admin') : null,
    estado: datos.salida ? 'cerrada' : 'abierta',
    editada: true,
    ultimaEdicionId: logId,
    expiraEn: Timestamp.fromMillis(datos.entrada.getTime() + datos.diasRetencion * 86400000),
    creadoEn: serverTimestamp(),
  });
  await b.commit();
  return r.id;
}

// ---------------------------------------------------------------- alertas
export async function resolverAlerta(
  actor: Actor,
  a: Alerta,
  estado: Exclude<EstadoAlerta, 'abierta'>,
  comentario: string,
) {
  const b = writeBatch(db);
  b.update(ref.alerta(a.id), {
    estado,
    resueltoPor: actor.uid,
    resueltoNombre: actor.nombre,
    comentario: comentario.trim() || null,
    resueltoEn: serverTimestamp(),
  });
  logEnLote(b, actor, {
    accion: estado === 'aceptada' ? 'aceptar_alerta' : 'rechazar_alerta',
    detalle: `${estado === 'aceptada' ? 'Aceptó' : 'Rechazó'} la marca de ${a.nombre} (${a.texto})`,
    motivo: comentario.trim() || null,
    refTipo: 'alerta',
    refId: a.id,
    cdId: a.cdId,
  });
  await b.commit();
}

// ---------------------------------------------------------------- usuarios
export async function cambiarEstadoUsuario(actor: Actor, u: Usuario, estado: Usuario['estado']) {
  const b = writeBatch(db);
  b.update(ref.user(u.uid), { estado });
  const verbo =
    estado === 'activo' ? (u.estado === 'pendiente' ? 'Aprobó el registro de' : 'Desbloqueó a') : 'Bloqueó a';
  logEnLote(b, actor, {
    accion:
      estado === 'activo'
        ? u.estado === 'pendiente'
          ? 'aprobar_usuario'
          : 'desbloquear_usuario'
        : 'bloquear_usuario',
    detalle: `${verbo} ${nombreCompleto(u)}`,
    refTipo: 'usuario',
    refId: u.uid,
    cdId: u.cdId,
    antes: { estado: u.estado },
    despues: { estado },
  });
  await b.commit();
}

export async function editarUsuario(
  actor: Actor,
  u: Usuario,
  d: { nombre: string; apellidos: string; rol: Rol; cdId: string },
) {
  const b = writeBatch(db);
  b.update(ref.user(u.uid), {
    nombre: d.nombre.trim(),
    apellidos: d.apellidos.trim(),
    rol: d.rol,
    cdId: d.cdId,
  });
  logEnLote(b, actor, {
    accion: 'editar_usuario',
    detalle: `Editó los datos de ${nombreCompleto(u)}`,
    refTipo: 'usuario',
    refId: u.uid,
    cdId: d.cdId,
    antes: { nombre: u.nombre, apellidos: u.apellidos, rol: u.rol, cdId: u.cdId },
    despues: d,
  });
  await b.commit();
}

export async function eliminarUsuario(actor: Actor, u: Usuario, rechazo = false) {
  const b = writeBatch(db);
  b.delete(ref.user(u.uid));
  logEnLote(b, actor, {
    accion: rechazo ? 'rechazar_usuario' : 'eliminar_usuario',
    detalle: `${rechazo ? 'Rechazó el registro de' : 'Eliminó al usuario'} ${nombreCompleto(u)}`,
    refTipo: 'usuario',
    refId: u.uid,
    cdId: u.cdId,
  });
  await b.commit();
}

export async function habilitarCambioFirma(actor: Actor, u: Usuario) {
  const b = writeBatch(db);
  b.update(ref.user(u.uid), { 'firma.cambioHabilitado': true });
  logEnLote(b, actor, {
    accion: 'habilitar_firma',
    detalle: `Habilitó cambio de firma para ${nombreCompleto(u)}`,
    refTipo: 'usuario',
    refId: u.uid,
    cdId: u.cdId,
  });
  notifEnLote(b, actor.uid, {
    para: 'usuario',
    uid: u.uid,
    cdId: u.cdId,
    tipo: 'firma_habilitada',
    texto: 'Ya puedes cambiar tu firma',
    enlace: 'firma',
  });
  await b.commit();
}

export async function aprobarDispositivo(actor: Actor, u: Usuario, nuevo: string) {
  const b = writeBatch(db);
  b.update(ref.user(u.uid), { deviceId: nuevo, deviceIdPendiente: null });
  logEnLote(b, actor, {
    accion: 'aprobar_dispositivo',
    detalle: `Aprobó el cambio de teléfono de ${nombreCompleto(u)}`,
    refTipo: 'usuario',
    refId: u.uid,
    cdId: u.cdId,
  });
  await b.commit();
}

export async function hacerAdmin(actor: Actor, u: Usuario) {
  const b = writeBatch(db);
  b.update(ref.user(u.uid), { rol: 'admin', estado: 'activo' });
  logEnLote(b, actor, {
    accion: 'nombrar_admin',
    detalle: `Dio rol de administrador a ${nombreCompleto(u)}`,
    refTipo: 'usuario',
    refId: u.uid,
    antes: { rol: u.rol },
    despues: { rol: 'admin' },
  });
  await b.commit();
}

export async function crearInvitacion(
  actor: Actor,
  d: { email: string; nombre: string; apellidos: string; rol: Rol; cdId: string },
) {
  const email = d.email.trim().toLowerCase();
  const b = writeBatch(db);
  b.set(ref.invitacion(email), {
    email,
    nombre: d.nombre.trim(),
    apellidos: d.apellidos.trim(),
    rol: d.rol,
    cdId: d.cdId,
    creadoPor: actor.uid,
    creadoEn: serverTimestamp(),
  });
  logEnLote(b, actor, {
    accion: 'invitar_usuario',
    detalle: `Invitó a ${d.nombre} ${d.apellidos} (${email}) como ${d.rol}`,
    refTipo: 'invitacion',
    refId: email,
    cdId: d.cdId,
  });
  await b.commit();
}

export async function borrarInvitacion(actor: Actor, email: string) {
  const b = writeBatch(db);
  b.delete(ref.invitacion(email));
  logEnLote(b, actor, {
    accion: 'borrar_invitacion',
    detalle: `Canceló la invitación de ${email}`,
    refTipo: 'invitacion',
    refId: email,
  });
  await b.commit();
}

// ---------------------------------------------------------------- CDs
export interface DatosCd {
  nombre: string;
  codigo: string;
  lat: number;
  lng: number;
  radioValido: number;
  radioAlerta: number;
  turnos: Turno[];
  toleranciaMin: number;
  paUids: string[];
}

export async function guardarCd(actor: Actor, d: DatosCd, previo: Cd | null) {
  const b = writeBatch(db);
  const datos = {
    nombre: d.nombre.trim(),
    codigo: d.codigo.trim(),
    ubicacion: new GeoPoint(d.lat, d.lng),
    radioValido: d.radioValido,
    radioAlerta: d.radioAlerta,
    turnos: d.turnos,
    toleranciaMin: d.toleranciaMin,
    qrHabilitado: previo?.qrHabilitado ?? false,
    qrRotacionSeg: previo?.qrRotacionSeg ?? 30,
    paUids: d.paUids,
    kioscoEmail: previo?.kioscoEmail ?? null,
  };
  b.set(ref.cd(datos.codigo), datos);
  logEnLote(b, actor, {
    accion: previo ? 'editar_cd' : 'crear_cd',
    detalle: previo
      ? `Actualizó geocerca y turnos de ${datos.nombre} ${datos.codigo}`
      : `Agregó el CD ${datos.nombre} ${datos.codigo}`,
    refTipo: 'cd',
    refId: datos.codigo,
    cdId: datos.codigo,
  });
  await b.commit();
}

export async function configurarQr(
  actor: Actor,
  cd: Cd,
  cambios: { qrHabilitado?: boolean; qrRotacionSeg?: number; kioscoEmail?: string | null },
) {
  const b = writeBatch(db);
  b.update(ref.cd(cd.id), cambios);
  const det =
    cambios.qrHabilitado !== undefined
      ? `${cambios.qrHabilitado ? 'Habilitó' : 'Deshabilitó'} el QR en ${cd.nombre} ${cd.codigo}`
      : cambios.qrRotacionSeg !== undefined
        ? `Cambió la rotación del QR de ${cd.nombre} ${cd.codigo} a ${cambios.qrRotacionSeg} s`
        : `Asignó la cuenta kiosco de ${cd.nombre} ${cd.codigo}`;
  logEnLote(b, actor, { accion: 'configurar_qr', detalle: det, refTipo: 'cd', refId: cd.id, cdId: cd.id });
  await b.commit();
}

// ---------------------------------------------------------------- kiosco
/** Una sola escritura por hora con los tokens de las próximas ventanas. */
export async function publicarLoteKiosco(cdId: string, rotSeg: number, ahora = new Date()) {
  const tokens = generarLote(ahora, rotSeg);
  await setDoc(ref.kiosco(cdId), {
    cdId,
    rotSeg,
    actualizadoEn: serverTimestamp(),
    tokens: Object.fromEntries(
      Object.entries(tokens).map(([t, v]) => [
        t,
        { desde: Timestamp.fromMillis(v.desde), hasta: Timestamp.fromMillis(v.hasta) },
      ]),
    ),
  });
  return tokens;
}

// ---------------------------------------------------------------- config
export async function guardarConfig(actor: Actor, c: ConfigGeneral, antes: ConfigGeneral) {
  const b = writeBatch(db);
  b.set(ref.config(), c);
  const cambios: string[] = [];
  if (c.diasRetencion !== antes.diasRetencion)
    cambios.push(`retención de ${antes.diasRetencion} a ${c.diasRetencion} días`);
  if (c.diasCambioFirma !== antes.diasCambioFirma)
    cambios.push(`días de firma de ${antes.diasCambioFirma} a ${c.diasCambioFirma}`);
  if (c.nombreApp !== antes.nombreApp) cambios.push(`nombre de la app a "${c.nombreApp}"`);
  if (c.tema !== antes.tema) cambios.push(`tema a ${c.tema}`);
  logEnLote(b, actor, {
    accion: 'configuracion',
    detalle: cambios.length ? `Cambió ${cambios.join(', ')}` : 'Actualizó la configuración general',
    refTipo: 'config',
    refId: 'general',
    antes,
    despues: c,
  });
  await b.commit();
}

// ---------------------------------------------------------------- solicitudes
export async function crearSolicitud(
  p: Usuario,
  d: { jornadaId: string | null; fecha: string; tipo: Solicitud['tipo']; texto: string },
) {
  const b = writeBatch(db);
  b.set(ref.nuevo('solicitudes'), {
    uid: p.uid,
    nombre: nombreCompleto(p),
    cdId: p.cdId,
    jornadaId: d.jornadaId,
    fecha: d.fecha,
    tipo: d.tipo,
    texto: d.texto.trim(),
    estado: 'abierta',
    respuesta: null,
    creadoEn: serverTimestamp(),
  });
  notifEnLote(b, p.uid, {
    para: 'staff',
    cdId: p.cdId,
    tipo: 'solicitud',
    texto: `${nombreCompleto(p)} pidió una corrección del ${d.fecha.split('-').reverse().join('/')}`,
    enlace: 'solicitudes',
  });
  await b.commit();
}

export async function resolverSolicitud(
  actor: Actor,
  s: Solicitud,
  estado: 'resuelta' | 'rechazada',
  respuesta: string,
) {
  const b = writeBatch(db);
  b.update(ref.solicitud(s.id), {
    estado,
    respuesta: respuesta.trim() || null,
    resueltoEn: serverTimestamp(),
  });
  logEnLote(b, actor, {
    accion: estado === 'resuelta' ? 'resolver_solicitud' : 'rechazar_solicitud',
    detalle: `${estado === 'resuelta' ? 'Resolvió' : 'Rechazó'} la solicitud de ${s.nombre} del ${s.fecha.split('-').reverse().join('/')}`,
    motivo: respuesta.trim() || null,
    refTipo: 'solicitud',
    refId: s.id,
    cdId: s.cdId,
  });
  notifEnLote(b, actor.uid, {
    para: 'usuario',
    uid: s.uid,
    cdId: s.cdId,
    tipo: 'solicitud_resuelta',
    texto: `Tu solicitud del ${s.fecha.split('-').reverse().join('/')} fue ${estado === 'resuelta' ? 'resuelta' : 'rechazada'}${respuesta.trim() ? `: ${respuesta.trim()}` : ''}`,
    enlace: 'solicitudes',
  });
  await b.commit();
}

// ---------------------------------------------------------------- notificaciones y reportes
export async function marcarLeida(id: string, uid: string) {
  await updateDoc(doc(col.notificaciones(), id), { leidaPor: arrayUnion(uid) });
}

export async function guardarReporte(actor: Actor, r: Record<string, unknown>) {
  const b = writeBatch(db);
  b.set(ref.nuevo('reportes'), { ...r, por: actor.uid, porNombre: actor.nombre, fecha: serverTimestamp() });
  logEnLote(b, actor, {
    accion: 'generar_reporte',
    detalle: `Generó reporte ${String(r.formato)}: ${String(r.nombre)}`,
    refTipo: 'reporte',
    cdId: (r.cdId as string | null) ?? null,
  });
  await b.commit();
}
