import type { Zona } from '@/types';

const R = 6371008.8; // radio medio de la Tierra en metros

export function distanciaM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function zonaPorDistancia(d: number, radioValido: number, radioAlerta: number): Zona {
  if (d <= radioValido) return 'valida';
  if (d <= radioAlerta) return 'observacion';
  return 'alerta';
}

export function distanciaTexto(d: number | null | undefined): string {
  if (d == null) return '—';
  if (d >= 1000) return `${(d / 1000).toFixed(1)} km`;
  return `${Math.round(d)} m`;
}

export const PRECISION_MAXIMA_M = 100;

export interface Lectura {
  lat: number;
  lng: number;
  precision: number;
}

/** Pide la ubicación con alta precisión; reintenta si la precisión es peor que 100 m. */
export async function obtenerUbicacion(
  opts: { intentos?: number; onReintento?: (precision: number, intento: number) => void } = {},
): Promise<Lectura> {
  const intentos = opts.intentos ?? 3;
  if (!('geolocation' in navigator)) throw new Error('Este teléfono no permite obtener la ubicación.');
  let mejor: Lectura | null = null;
  for (let i = 1; i <= intentos; i++) {
    const pos = await new Promise<GeolocationPosition>((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }),
    ).catch((e: GeolocationPositionError) => {
      if (e.code === 1) throw new Error('Debes permitir el acceso a la ubicación para marcar.');
      if (e.code === 3) throw new Error('El GPS tardó demasiado. Sal a un lugar abierto e intenta de nuevo.');
      throw new Error('No se pudo obtener la ubicación. Revisa que el GPS esté encendido.');
    });
    const l = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      precision: Math.round(pos.coords.accuracy),
    };
    if (!mejor || l.precision < mejor.precision) mejor = l;
    if (l.precision <= PRECISION_MAXIMA_M) return l;
    opts.onReintento?.(l.precision, i);
  }
  return mejor!;
}
