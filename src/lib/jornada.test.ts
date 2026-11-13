import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import type { Jornada, Marca } from '@/types';
import { isoADate } from './fechas';
import {
  calificarDia,
  esSinConexion,
  estadoJornada,
  estadoMarca,
  horaEfectiva,
  jornadaVigente,
  minutosTarde,
  minutosTrabajados,
  resolucionesDe,
} from './jornada';

const ts = (d: Date) => Timestamp.fromDate(d);

function marca(fecha: string, hhmm: string, extra: Partial<Marca> = {}): Marca {
  const d = isoADate(fecha, hhmm);
  return {
    horaServidor: ts(d),
    horaDispositivo: ts(d),
    metodo: 'gps',
    lat: 13.67,
    lng: -89.27,
    precision: 10,
    distanciaM: 20,
    zona: 'valida',
    offline: false,
    deviceId: 'tel',
    dispositivoDistinto: false,
    qrToken: null,
    ...extra,
  };
}

function jornada(extra: Partial<Jornada> = {}): Jornada {
  return {
    id: 'j',
    uid: 'u',
    nombre: 'Carlos Méndez',
    cdId: '5184',
    fecha: '2026-11-09',
    turno: { nombre: 'Nocturno', inicio: '22:00', fin: '06:00' },
    toleranciaMin: 10,
    entrada: marca('2026-11-09', '22:00'),
    salida: null,
    estado: 'abierta',
    editada: false,
    ultimaEdicionId: null,
    expiraEn: ts(new Date()),
    creadoEn: ts(new Date()),
    ...extra,
  };
}

describe('turno nocturno', () => {
  it('entrada 22:00 y salida 06:00 del día siguiente = una sola jornada de 8 h', () => {
    const j = jornada({ salida: marca('2026-11-10', '06:00'), estado: 'cerrada' });
    expect(j.fecha).toBe('2026-11-09');
    expect(minutosTrabajados(j)).toBe(8 * 60);
  });

  it('llegar a las 22:05 con 10 min de tolerancia no es tardanza; a las 22:15 sí', () => {
    expect(minutosTarde(jornada({ entrada: marca('2026-11-09', '22:05') }))).toBe(0);
    expect(minutosTarde(jornada({ entrada: marca('2026-11-09', '22:15') }))).toBe(15);
  });

  it('llegar antes del inicio (21:50) no es tardanza', () => {
    expect(minutosTarde(jornada({ entrada: marca('2026-11-09', '21:50') }))).toBe(0);
  });

  it('pasada la medianoche cuenta como tardanza del turno nocturno', () => {
    expect(minutosTarde(jornada({ fecha: '2026-11-10', entrada: marca('2026-11-10', '00:30') }))).toBe(150);
  });

  it('sin horario definido ([hh:mm]) nunca marca tardanza', () => {
    expect(
      minutosTarde(
        jornada({ turno: { nombre: 'Diurno', inicio: '', fin: '' }, entrada: marca('2026-11-09', '11:00') }),
      ),
    ).toBe(0);
  });
});

describe('vigencia y estado', () => {
  it('una jornada abierta sigue "en turno" durante 20 h', () => {
    const j = jornada();
    expect(jornadaVigente(j, isoADate('2026-11-10', '06:00'))).toBe(true);
    expect(jornadaVigente(j, isoADate('2026-11-10', '19:00'))).toBe(false);
    expect(estadoJornada(j, {}, isoADate('2026-11-10', '19:00')).texto).toBe('Sin salida');
  });

  it('la peor marca define el estado', () => {
    const j = jornada({
      salida: marca('2026-11-10', '06:00', { zona: 'observacion', distanciaM: 420 }),
      estado: 'cerrada',
    });
    expect(estadoJornada(j).texto).toBe('Observación');
    const k = jornada({
      salida: marca('2026-11-10', '06:00', { zona: 'alerta', distanciaM: 1300 }),
      estado: 'cerrada',
    });
    expect(estadoJornada(k).texto).toBe('Fuera de 1 km');
    const ok = jornada({ salida: marca('2026-11-10', '06:00'), estado: 'cerrada' });
    expect(estadoJornada(ok).texto).toBe('Completa');
  });

  it('una alerta aceptada vuelve la marca a verde', () => {
    const j = jornada({ salida: marca('2026-11-10', '06:00', { zona: 'alerta' }), estado: 'cerrada' });
    const res = resolucionesDe(
      [{ id: 'j_salida', jornadaId: 'j', parte: 'salida', estado: 'aceptada' } as never],
      'j',
    );
    expect(estadoJornada(j, res).texto).toBe('Completa');
  });

  it('marca editada por admin es válida', () => {
    expect(estadoMarca(marca('2026-11-09', '22:00', { metodo: 'admin', zona: 'alerta' }))).toBe('ok');
  });

  it('otro teléfono deja la marca en observación', () => {
    expect(estadoMarca(marca('2026-11-09', '22:00', { dispositivoDistinto: true }))).toBe('obs');
  });
});

describe('sin conexión', () => {
  it('si servidor y teléfono difieren más de 5 min queda "Sin conexión" y vale la hora del teléfono', () => {
    const m = marca('2026-11-10', '13:02');
    m.horaServidor = ts(isoADate('2026-11-10', '13:20'));
    expect(esSinConexion(m)).toBe(true);
    expect(estadoMarca(m)).toBe('sync');
    expect(horaEfectiva(m).getTime()).toBe(isoADate('2026-11-10', '13:02').getTime());
  });

  it('con menos de 5 min de diferencia vale la hora del servidor', () => {
    const m = marca('2026-11-10', '13:02');
    m.horaServidor = ts(isoADate('2026-11-10', '13:04'));
    expect(esSinConexion(m)).toBe(false);
    expect(horaEfectiva(m).getTime()).toBe(isoADate('2026-11-10', '13:04').getTime());
  });
});

describe('calendario', () => {
  it('día libre, a tiempo, con observación y tardanza', () => {
    const ahora = isoADate('2026-11-12', '12:00');
    expect(calificarDia([], {}, ahora)).toBe('off');
    expect(
      calificarDia([jornada({ salida: marca('2026-11-10', '06:00'), estado: 'cerrada' })], {}, ahora),
    ).toBe('ok');
    expect(
      calificarDia(
        [jornada({ salida: marca('2026-11-10', '06:00', { zona: 'observacion' }), estado: 'cerrada' })],
        {},
        ahora,
      ),
    ).toBe('obs');
    expect(
      calificarDia(
        [
          jornada({
            entrada: marca('2026-11-09', '22:30'),
            salida: marca('2026-11-10', '06:00'),
            estado: 'cerrada',
          }),
        ],
        {},
        ahora,
      ),
    ).toBe('late');
    expect(calificarDia([jornada()], {}, ahora)).toBe('late');
  });
});

describe('tardanza fuera del turno', () => {
  it('entrar después de que terminó el turno no se cuenta como tardanza', () => {
    const j = jornada({
      turno: { nombre: 'Vespertino', inicio: '14:00', fin: '22:00' },
      entrada: marca('2026-11-09', '23:30'),
    });
    expect(minutosTarde(j)).toBe(0);
  });
});
