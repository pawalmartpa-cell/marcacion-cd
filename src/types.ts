import type { GeoPoint, Timestamp } from 'firebase/firestore';

export type Rol = 'admin' | 'pa' | 'seguridad' | 'kiosco';
export type EstadoUsuario = 'pendiente' | 'activo' | 'bloqueado';
export type Proveedor = 'google' | 'correo';
export type NombreTurno = 'Diurno' | 'Vespertino' | 'Nocturno';
export const NOMBRES_TURNO: NombreTurno[] = ['Diurno', 'Vespertino', 'Nocturno'];

/** Rango de un turno en hora local de El Salvador. `inicio`/`fin` = 'HH:mm' o '' si aún no se define. */
export interface Turno {
  nombre: NombreTurno;
  inicio: string;
  fin: string;
}

export interface Firma {
  tipo: 'dibujada' | 'generada';
  svg: string;
  fuente: string | null;
  actualizadaEn: Timestamp;
  cambioHabilitado: boolean;
}

export interface Usuario {
  uid: string;
  nombre: string;
  apellidos: string;
  email: string;
  rol: Rol;
  cdId: string;
  estado: EstadoUsuario;
  proveedor: Proveedor;
  deviceId: string | null;
  deviceIdPendiente?: string | null;
  firma: Firma | null;
  consentimientoUbicacion: boolean;
  creadoEn: Timestamp;
}

export interface Cd {
  id: string;
  nombre: string;
  codigo: string;
  ubicacion: GeoPoint;
  radioValido: number;
  radioAlerta: number;
  turnos: Turno[];
  toleranciaMin: number;
  qrHabilitado: boolean;
  qrRotacionSeg: number;
  paUids: string[];
  kioscoEmail?: string | null;
}

export type Zona = 'valida' | 'observacion' | 'alerta';
export type Metodo = 'gps' | 'qr' | 'admin';
export type Parte = 'entrada' | 'salida';

export interface Marca {
  horaServidor: Timestamp;
  horaDispositivo: Timestamp;
  metodo: Metodo;
  lat: number | null;
  lng: number | null;
  precision: number | null;
  distanciaM: number | null;
  zona: Zona;
  offline: boolean;
  deviceId: string;
  dispositivoDistinto: boolean;
  qrToken: string | null;
}

export interface Jornada {
  id: string;
  uid: string;
  nombre: string;
  cdId: string;
  /** Fecha de la ENTRADA (yyyy-MM-dd, hora de El Salvador). */
  fecha: string;
  turno: Turno;
  toleranciaMin: number;
  entrada: Marca;
  salida: Marca | null;
  estado: 'abierta' | 'cerrada';
  editada: boolean;
  ultimaEdicionId: string | null;
  entradaOriginal?: Marca | null;
  salidaOriginal?: Marca | null;
  expiraEn: Timestamp;
  creadoEn: Timestamp;
  /** Solo en el cliente: escritura guardada en el teléfono que aún no llega al servidor. */
  _pendiente?: boolean;
}

export type TipoAlerta = 'fuera_rango' | 'observacion' | 'sin_conexion' | 'dispositivo' | 'sin_salida';
export type Severidad = 'alta' | 'media' | 'info';
export type EstadoAlerta = 'abierta' | 'aceptada' | 'rechazada';

export interface Alerta {
  id: string;
  jornadaId: string;
  uid: string;
  nombre: string;
  cdId: string;
  parte: Parte;
  tipo: TipoAlerta;
  severidad: Severidad;
  texto: string;
  distanciaM: number | null;
  estado: EstadoAlerta;
  resueltoPor: string | null;
  resueltoNombre?: string | null;
  comentario: string | null;
  creadoEn: Timestamp;
  resueltoEn?: Timestamp | null;
}

export interface KioscoDoc {
  cdId: string;
  rotSeg: number;
  tokens: Record<string, { desde: Timestamp; hasta: Timestamp }>;
  actualizadoEn: Timestamp;
}

export interface EntradaBitacora {
  id: string;
  quien: string;
  quienNombre: string;
  rol: Rol;
  accion: string;
  detalle: string;
  motivo: string | null;
  refTipo: string | null;
  refId: string | null;
  cdId: string | null;
  antes: unknown;
  despues: unknown;
  fecha: Timestamp;
}

export interface Notificacion {
  id: string;
  /** staff = admins y PA del CD · admin = solo administradores · usuario = una persona. */
  para: 'staff' | 'admin' | 'usuario';
  uid: string | null;
  cdId: string | null;
  tipo: 'firma' | 'registro' | 'alerta' | 'solicitud' | 'firma_habilitada' | 'solicitud_resuelta';
  texto: string;
  enlace: string | null;
  creadoPor: string;
  creadoEn: Timestamp;
  leidaPor: string[];
}

export interface ConfigGeneral {
  diasRetencion: number;
  diasCambioFirma: number;
  nombreApp: string;
  tema: 'claro' | 'oscuro' | 'auto';
}

export interface Solicitud {
  id: string;
  uid: string;
  nombre: string;
  cdId: string;
  jornadaId: string | null;
  fecha: string;
  tipo: 'olvido_entrada' | 'olvido_salida' | 'hora_incorrecta' | 'otro';
  texto: string;
  estado: 'abierta' | 'resuelta' | 'rechazada';
  respuesta: string | null;
  creadoEn: Timestamp;
  resueltoEn?: Timestamp | null;
}

export interface Invitacion {
  email: string;
  nombre: string;
  apellidos: string;
  rol: Rol;
  cdId: string;
  creadoPor: string;
  creadoEn: Timestamp;
}

export interface ReporteGenerado {
  id: string;
  nombre: string;
  tipo: string;
  formato: 'Excel' | 'PDF';
  desde: string;
  hasta: string;
  cdId: string | null;
  uidGuardia: string | null;
  incluirFirma: boolean;
  por: string;
  porNombre: string;
  fecha: Timestamp;
}

export const ROL_TEXTO: Record<Rol, string> = {
  admin: 'Admin',
  pa: 'PA',
  seguridad: 'Seguridad',
  kiosco: 'Kiosco QR',
};

export const ESTADO_USUARIO_TEXTO: Record<EstadoUsuario, string> = {
  pendiente: 'Pendiente',
  activo: 'Activo',
  bloqueado: 'Bloqueado',
};

export const CONFIG_POR_DEFECTO: ConfigGeneral = {
  diasRetencion: 90,
  diasCambioFirma: 30,
  nombreApp: 'Marcación CD',
  tema: 'auto',
};
