/** Contenido del QR: MCD|{cdId}|{token} */
export const PREFIJO_QR = 'MCD';
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function tokenAleatorio(largo = 12): string {
  const bytes = new Uint8Array(largo);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('');
}

export interface Ventana {
  desde: number;
  hasta: number;
}

/** Inicio de la ventana que contiene `t` (ms). */
export function inicioVentana(t: number, rotSeg: number): number {
  const r = rotSeg * 1000;
  return Math.floor(t / r) * r;
}

/**
 * Lote de tokens desde la ventana actual hasta `minutos` después (por defecto 65 min: una hora
 * más 5 min de margen para la siguiente regeneración). Se guarda en una sola escritura.
 */
export function generarLote(ahora: Date, rotSeg: number, minutos = 65): Record<string, Ventana> {
  const r = rotSeg * 1000;
  const ini = inicioVentana(ahora.getTime(), rotSeg);
  const fin = ahora.getTime() + minutos * 60000;
  const lote: Record<string, Ventana> = {};
  for (let t = ini; t < fin; t += r) {
    let tok = tokenAleatorio();
    while (lote[tok]) tok = tokenAleatorio();
    lote[tok] = { desde: t, hasta: t + r };
  }
  return lote;
}

export function tokenVigente(
  lote: Record<string, Ventana>,
  ahora = Date.now(),
): { token: string; ventana: Ventana } | null {
  for (const [token, ventana] of Object.entries(lote)) {
    if (ahora >= ventana.desde && ahora < ventana.hasta) return { token, ventana };
  }
  return null;
}

/** Minutos que le quedan al lote antes de agotarse. */
export function minutosRestantesLote(lote: Record<string, Ventana>, ahora = Date.now()): number {
  const max = Math.max(0, ...Object.values(lote).map((v) => v.hasta));
  return (max - ahora) / 60000;
}

export function contenidoQr(cdId: string, token: string): string {
  return `${PREFIJO_QR}|${cdId}|${token}`;
}

export function leerQr(texto: string): { cdId: string; token: string } | null {
  const m = /^MCD\|([^|]{1,20})\|([A-Z0-9]{6,32})$/.exec(texto.trim());
  return m ? { cdId: m[1]!, token: m[2]! } : null;
}
