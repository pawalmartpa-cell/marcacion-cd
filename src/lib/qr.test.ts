import { describe, expect, it } from 'vitest';
import { contenidoQr, generarLote, leerQr, minutosRestantesLote, tokenVigente } from './qr';

describe('QR por lotes', () => {
  const ahora = new Date('2026-11-10T19:00:10Z');
  it('genera ventanas consecutivas para ~65 min en una sola escritura', () => {
    const lote = generarLote(ahora, 30);
    const v = Object.values(lote).sort((a, b) => a.desde - b.desde);
    expect(v.length).toBe(131);
    expect(v[0]!.desde).toBe(new Date('2026-11-10T19:00:00Z').getTime());
    for (let i = 1; i < v.length; i++) expect(v[i]!.desde).toBe(v[i - 1]!.hasta);
    expect(new Set(Object.keys(lote)).size).toBe(v.length);
  });
  it('encuentra el token vigente', () => {
    const lote = generarLote(ahora, 15);
    const t = tokenVigente(lote, ahora.getTime() + 40_000);
    expect(t).not.toBeNull();
    expect(t!.ventana.desde).toBe(new Date('2026-11-10T19:00:45Z').getTime());
    expect(minutosRestantesLote(lote, ahora.getTime())).toBeGreaterThan(64);
  });
  it('lee solo QR de la app', () => {
    expect(leerQr(contenidoQr('5184', 'ABCDEFGH2345'))).toEqual({ cdId: '5184', token: 'ABCDEFGH2345' });
    expect(leerQr('https://ejemplo.com')).toBeNull();
    expect(leerQr('MCD|5184|<script>')).toBeNull();
  });
});
