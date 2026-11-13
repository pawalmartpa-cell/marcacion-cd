import { describe, expect, it } from 'vitest';
import { distanciaM, distanciaTexto, zonaPorDistancia } from './geo';

describe('geocerca', () => {
  const cd = { lat: 13.6731, lng: -89.2794 };
  it('calcula distancias en metros', () => {
    const d = distanciaM(cd.lat, cd.lng, cd.lat + 0.0045, cd.lng);
    expect(d).toBeGreaterThan(495);
    expect(d).toBeLessThan(505);
  });
  it('zonas: ≤150 válida, 150–1000 observación, >1000 alerta', () => {
    expect(zonaPorDistancia(38, 150, 1000)).toBe('valida');
    expect(zonaPorDistancia(150, 150, 1000)).toBe('valida');
    expect(zonaPorDistancia(420, 150, 1000)).toBe('observacion');
    expect(zonaPorDistancia(1000, 150, 1000)).toBe('observacion');
    expect(zonaPorDistancia(1300, 150, 1000)).toBe('alerta');
  });
  it('texto', () => {
    expect(distanciaTexto(38.4)).toBe('38 m');
    expect(distanciaTexto(1300)).toBe('1.3 km');
    expect(distanciaTexto(null)).toBe('—');
  });
});
