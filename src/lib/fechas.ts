import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';

export const ZONA = 'America/El_Salvador';

type FechaLike = Date | number | { toDate(): Date } | null | undefined;

export function aDate(v: FechaLike): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  if (typeof (v as { toDate?: unknown }).toDate === 'function') return (v as { toDate(): Date }).toDate();
  return null;
}

/** 'yyyy-MM-dd' en hora de El Salvador. */
export function fechaISO(v: FechaLike = new Date()): string {
  const d = aDate(v) ?? new Date();
  return formatInTimeZone(d, ZONA, 'yyyy-MM-dd');
}

/** 'HH:mm' (24 h) en hora de El Salvador. */
export function hora(v: FechaLike): string {
  const d = aDate(v);
  return d ? formatInTimeZone(d, ZONA, 'HH:mm') : '—';
}

/** dd/mm/aaaa */
export function fechaCorta(v: FechaLike | string): string {
  if (typeof v === 'string') {
    const [y, m, d] = v.split('-');
    return y && m && d ? `${d}/${m}/${y}` : v;
  }
  const d = aDate(v);
  return d ? formatInTimeZone(d, ZONA, 'dd/MM/yyyy') : '—';
}

/** dd/mm/aaaa HH:mm */
export function fechaHora(v: FechaLike): string {
  const d = aDate(v);
  return d ? formatInTimeZone(d, ZONA, 'dd/MM/yyyy HH:mm') : '—';
}

/** "martes 10 de noviembre de 2026" */
export function fechaLarga(v: FechaLike | string = new Date()): string {
  const d = typeof v === 'string' ? isoADate(v) : (aDate(v) ?? new Date());
  const t = formatInTimeZone(d, ZONA, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function mesAnio(anio: number, mes: number): string {
  const d = fromZonedTime(`${anio}-${String(mes).padStart(2, '0')}-15T12:00:00`, ZONA);
  const t = formatInTimeZone(d, ZONA, "MMMM 'de' yyyy", { locale: es });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Medianoche local de El Salvador de una fecha ISO, como Date (UTC). */
export function isoADate(iso: string, hhmm = '00:00'): Date {
  return fromZonedTime(`${iso}T${hhmm}:00`, ZONA);
}

export function sumarDiasISO(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const base = new Date(Date.UTC(y!, m! - 1, d!));
  const r = addDays(base, dias);
  return r.toISOString().slice(0, 10);
}

export function diasEntreISO(a: string, b: string): number {
  return differenceInCalendarDays(new Date(`${b}T00:00:00Z`), new Date(`${a}T00:00:00Z`));
}

/** Día de la semana (0 = domingo) de una fecha ISO. */
export function diaSemanaISO(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

/** Lunes de la semana de la fecha dada (ISO). */
export function lunesDeISO(iso: string): string {
  const dow = diaSemanaISO(iso);
  return sumarDiasISO(iso, dow === 0 ? -6 : 1 - dow);
}

export function minutosDeHHMM(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** Minutos desde la medianoche local de El Salvador. */
export function minutosLocales(v: FechaLike): number {
  const d = toZonedTime(aDate(v) ?? new Date(), ZONA);
  return d.getHours() * 60 + d.getMinutes();
}

export function duracionTexto(min: number | null): string {
  if (min == null || Number.isNaN(min)) return '—';
  const h = Math.floor(min / 60);
  return `${h} h ${String(min % 60).padStart(2, '0')} min`;
}

export function haceTexto(v: FechaLike): string {
  const d = aDate(v);
  if (!d) return '—';
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return fechaHora(d);
}
