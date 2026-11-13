import type { Alerta, EstadoAlerta, Jornada, Marca, Parte, Turno } from '@/types';
import { aDate, minutosDeHHMM, minutosLocales } from './fechas';
import { distanciaTexto } from './geo';

/** Diferencia máxima permitida entre la hora del servidor y la del teléfono. */
export const DESFASE_MAX_MIN = 5;
/** Una jornada abierta deja de considerarse "en turno" después de estas horas. */
export const HORAS_JORNADA_VIGENTE = 20;

export type EstadoMarca = 'ok' | 'obs' | 'alerta' | 'sync' | 'aceptada' | 'rechazada';
export type Tono = 'ok' | 'warn' | 'bad' | 'info' | 'neutral';

export const ESTADO_MARCA: Record<EstadoMarca, { texto: string; tono: Tono; color: string }> = {
  ok: { texto: 'Dentro del radio', tono: 'ok', color: '#1FA463' },
  obs: { texto: 'Observación', tono: 'warn', color: '#E0A100' },
  alerta: { texto: 'Fuera de 1 km', tono: 'bad', color: '#D93A26' },
  sync: { texto: 'Sin conexión · sincronizada', tono: 'info', color: '#0071CE' },
  aceptada: { texto: 'Aceptada', tono: 'ok', color: '#1FA463' },
  rechazada: { texto: 'Rechazada', tono: 'bad', color: '#D93A26' },
};

const RANGO: Record<EstadoMarca, number> = { alerta: 4, rechazada: 4, obs: 3, sync: 2, ok: 1, aceptada: 1 };

export function desfaseMin(m: Marca): number {
  const s = aDate(m.horaServidor);
  const d = aDate(m.horaDispositivo);
  if (!s || !d) return 0;
  return Math.abs(s.getTime() - d.getTime()) / 60000;
}

export function esSinConexion(m: Marca): boolean {
  if (m.metodo === 'admin') return false;
  return m.offline || desfaseMin(m) > DESFASE_MAX_MIN;
}

/**
 * Hora que vale para la marca. Si se sincronizó tarde (sin conexión), vale la hora del teléfono
 * y la marca queda identificada para revisión; si no, siempre la del servidor.
 */
export function horaEfectiva(m: Marca): Date {
  const s = aDate(m.horaServidor);
  const d = aDate(m.horaDispositivo);
  // Mientras la escritura está pendiente (sin conexión), serverTimestamp aún no existe.
  if (!s) return d ?? new Date();
  if (m.metodo !== 'admin' && d && esSinConexion(m)) return d;
  return s;
}

export function estadoMarca(m: Marca, resolucion?: EstadoAlerta | null): EstadoMarca {
  if (resolucion === 'aceptada') return 'aceptada';
  if (resolucion === 'rechazada') return 'rechazada';
  if (m.metodo === 'admin') return 'ok';
  if (m.zona === 'alerta') return 'alerta';
  if (m.zona === 'observacion' || m.dispositivoDistinto) return 'obs';
  if (esSinConexion(m)) return 'sync';
  return 'ok';
}

export function metodoTexto(m: Marca): string {
  if (m.metodo === 'admin') return 'Editada por admin';
  if (m.metodo === 'qr') return 'QR kiosco';
  return esSinConexion(m) ? 'GPS sin conexión' : 'GPS';
}

export function detalleMarca(m: Marca): string {
  const partes = [metodoTexto(m)];
  if (m.distanciaM != null) partes.push(distanciaTexto(m.distanciaM));
  return partes.join(' · ');
}

export function minutosTrabajados(j: Pick<Jornada, 'entrada' | 'salida'>): number | null {
  if (!j.salida) return null;
  const diff = Math.round((horaEfectiva(j.salida).getTime() - horaEfectiva(j.entrada).getTime()) / 60000);
  return diff >= 0 ? diff : null;
}

/** Minutos de tardanza (0 si llegó a tiempo o el turno no tiene horario definido). */
export function minutosTarde(j: Pick<Jornada, 'entrada' | 'turno' | 'toleranciaMin'>): number {
  const ini = minutosDeHHMM(j.turno?.inicio ?? '');
  if (ini == null) return 0;
  const llegada = minutosLocales(horaEfectiva(j.entrada));
  let diff = (llegada - ini + 1440) % 1440;
  if (diff > 720) diff -= 1440; // llegó antes del inicio
  // Si llegó después de que terminó el turno, no es "tardanza" sino otro caso (lo revisa el PA).
  const fin = minutosDeHHMM(j.turno?.fin ?? '');
  const duracion = fin == null ? 720 : (fin - ini + 1440) % 1440 || 1440;
  if (diff > duracion) return 0;
  return diff > (j.toleranciaMin ?? 0) ? diff : 0;
}

export function esTarde(j: Pick<Jornada, 'entrada' | 'turno' | 'toleranciaMin'>): boolean {
  return minutosTarde(j) > 0;
}

export function jornadaVigente(
  j: Pick<Jornada, 'estado' | 'entrada' | 'salida'>,
  ahora = new Date(),
): boolean {
  if (j.salida || j.estado === 'cerrada') return false;
  const ent = horaEfectiva(j.entrada);
  return ahora.getTime() - ent.getTime() < HORAS_JORNADA_VIGENTE * 3600 * 1000;
}

export type Resoluciones = Partial<Record<Parte, EstadoAlerta>>;

/** Resolución de alertas por parte de una jornada (la peor alerta resuelta manda). */
export function resolucionesDe(alertas: Alerta[], jornadaId: string): Resoluciones {
  const r: Resoluciones = {};
  for (const a of alertas) {
    if (a.jornadaId !== jornadaId || a.estado === 'abierta') continue;
    if (r[a.parte] === 'rechazada') continue;
    r[a.parte] = a.estado;
  }
  return r;
}

export interface EstadoJornada {
  texto: string;
  tono: Tono;
  pendiente: boolean;
}

export function estadoJornada(j: Jornada, res: Resoluciones = {}, ahora = new Date()): EstadoJornada {
  if (!j.salida) {
    return jornadaVigente(j, ahora)
      ? { texto: 'En turno', tono: 'info', pendiente: false }
      : { texto: 'Sin salida', tono: 'bad', pendiente: true };
  }
  const a = estadoMarca(j.entrada, res.entrada);
  const b = estadoMarca(j.salida, res.salida);
  const peor = RANGO[a] >= RANGO[b] ? a : b;
  if (peor === 'ok' || peor === 'aceptada') return { texto: 'Completa', tono: 'ok', pendiente: false };
  const e = ESTADO_MARCA[peor];
  return { texto: e.texto, tono: e.tono, pendiente: true };
}

export type CalificacionDia = 'ok' | 'obs' | 'late' | 'off';

export function calificarDia(
  js: Jornada[],
  res: Record<string, Resoluciones> = {},
  ahora = new Date(),
): CalificacionDia {
  if (!js.length) return 'off';
  let peor: CalificacionDia = 'ok';
  for (const j of js) {
    if (esTarde(j) || (!j.salida && !jornadaVigente(j, ahora))) return 'late';
    const e = estadoJornada(j, res[j.id] ?? {}, ahora);
    if (e.pendiente) peor = 'obs';
  }
  return peor;
}

export function textoTurno(t: Turno): string {
  return t.inicio && t.fin ? `${t.nombre} · ${t.inicio} – ${t.fin}` : `${t.nombre} · [hh:mm – hh:mm]`;
}
