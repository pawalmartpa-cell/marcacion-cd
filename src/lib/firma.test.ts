import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { diasParaCambiarFirma, svgADataUri, svgFirmaGenerada, textoDeFirma } from './firma';

describe('firma', () => {
  it('genera un SVG con el nombre escapado y lo recupera', () => {
    const svg = svgFirmaGenerada('Ana <b>Rivas</b> & Co', 'Allura');
    expect(svg).toContain('font-family="Allura, cursive"');
    expect(svg).not.toContain('<b>');
    expect(textoDeFirma(svg)).toBe('Ana <b>Rivas</b> & Co');
  });
  it('se muestra como data-URI (sin insertar el SVG en la página)', () => {
    expect(svgADataUri('<svg/>')).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });
  it('calcula los días que faltan para poder cambiarla', () => {
    const ahora = new Date('2026-11-10T12:00:00Z');
    const f = (dias: number, habil = false) => ({
      tipo: 'generada' as const,
      svg: '',
      fuente: 'Allura',
      actualizadaEn: Timestamp.fromDate(new Date(ahora.getTime() - dias * 86400000)),
      cambioHabilitado: habil,
    });
    expect(diasParaCambiarFirma(f(5), 30, ahora)).toBe(25);
    expect(diasParaCambiarFirma(f(31), 30, ahora)).toBe(0);
    expect(diasParaCambiarFirma(f(5, true), 30, ahora)).toBe(0);
    expect(diasParaCambiarFirma(null, 30, ahora)).toBe(0);
  });
});
