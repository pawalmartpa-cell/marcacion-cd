import { describe, expect, it } from 'vitest';
import {
  diaSemanaISO,
  duracionTexto,
  fechaCorta,
  fechaISO,
  hora,
  isoADate,
  lunesDeISO,
  minutosDeHHMM,
  sumarDiasISO,
} from './fechas';

describe('fechas en hora de El Salvador (UTC-6)', () => {
  it('las 03:00 UTC son las 21:00 del día anterior en El Salvador', () => {
    const d = new Date('2026-11-10T03:00:00Z');
    expect(fechaISO(d)).toBe('2026-11-09');
    expect(hora(d)).toBe('21:00');
  });

  it('isoADate respeta la zona', () => {
    expect(isoADate('2026-11-10', '22:00').toISOString()).toBe('2026-11-11T04:00:00.000Z');
  });

  it('formatos dd/mm/aaaa y 24 h', () => {
    expect(fechaCorta('2026-11-09')).toBe('09/11/2026');
    expect(hora(isoADate('2026-11-09', '13:05'))).toBe('13:05');
  });

  it('suma de días y lunes de la semana', () => {
    expect(sumarDiasISO('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDiasISO('2026-03-01', -1)).toBe('2026-02-28');
    expect(diaSemanaISO('2026-11-01')).toBe(0);
    expect(lunesDeISO('2026-11-12')).toBe('2026-11-09');
    expect(lunesDeISO('2026-11-15')).toBe('2026-11-09');
  });

  it('HH:mm a minutos y duración', () => {
    expect(minutosDeHHMM('06:30')).toBe(390);
    expect(minutosDeHHMM('[hh:mm]')).toBeNull();
    expect(minutosDeHHMM('25:00')).toBeNull();
    expect(duracionTexto(485)).toBe('8 h 05 min');
  });
});
