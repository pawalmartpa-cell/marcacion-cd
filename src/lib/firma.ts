import type { Firma } from '@/types';

export const FUENTES_FIRMA = ['Great Vibes', 'Dancing Script', 'Allura'] as const;
export type FuenteFirma = (typeof FUENTES_FIRMA)[number];

const escXml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  );

/** SVG de una firma generada a partir del nombre. */
export function svgFirmaGenerada(nombre: string, fuente: FuenteFirma): string {
  const tam = fuente === 'Dancing Script' ? 40 : 50;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100" width="400" height="100">` +
    `<text x="200" y="66" text-anchor="middle" font-family="${fuente}, cursive" font-size="${tam}" fill="#041E42">${escXml(nombre.trim())}</text>` +
    `</svg>`
  );
}

/** Texto de una firma generada (para dibujarla con la fuente ya cargada). */
export function textoDeFirma(svg: string): string {
  const m = /<text[^>]*>([\s\S]*?)<\/text>/.exec(svg);
  if (!m) return '';
  return m[1]!
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Data-URI seguro para mostrar un SVG dibujado: dentro de <img> el navegador no ejecuta scripts,
 * así una firma manipulada no puede inyectar código.
 */
export function svgADataUri(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export function diasParaCambiarFirma(f: Firma | null, diasCambio: number, ahora = new Date()): number {
  if (!f || f.cambioHabilitado) return 0;
  const t = f.actualizadaEn?.toDate?.() ?? ahora;
  const libre = t.getTime() + diasCambio * 86400000;
  return Math.max(0, Math.ceil((libre - ahora.getTime()) / 86400000));
}

/** Convierte una firma en PNG (para Excel/PDF). */
export async function firmaAPng(f: Firma, ancho = 400, alto = 100): Promise<string | null> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ancho, alto);
    if (f.tipo === 'generada' && f.fuente) {
      const tam = f.fuente === 'Dancing Script' ? 40 : 50;
      await document.fonts?.load(`${tam}px "${f.fuente}"`);
      ctx.fillStyle = '#041E42';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = `${tam}px "${f.fuente}", cursive`;
      const texto = textoDeFirma(f.svg);
      let t = tam;
      while (ctx.measureText(texto).width > ancho - 16 && t > 14) {
        t -= 2;
        ctx.font = `${t}px "${f.fuente}", cursive`;
      }
      ctx.fillText(texto, ancho / 2, alto * 0.66);
    } else {
      const img = new Image();
      img.src = svgADataUri(f.svg);
      await img.decode();
      const r = Math.min(ancho / img.width, alto / img.height);
      const w = img.width * r;
      const h = img.height * r;
      ctx.drawImage(img, (ancho - w) / 2, (alto - h) / 2, w, h);
    }
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('No se pudo convertir la firma', e);
    return null;
  }
}
