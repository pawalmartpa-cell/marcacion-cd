// Genera los íconos PNG de la PWA a partir de SVG usando el Chromium de Playwright.
// Uso: node scripts/generar-iconos.mjs  (ya están generados en public/icons; solo si cambias el diseño)
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const icono = (tam, maskable) => {
  const pad = maskable ? tam * 0.2 : tam * 0.12;
  const r = (tam - pad * 2) / 2;
  const c = tam / 2;
  const fondo = maskable ? '#FFC220' : 'transparent';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}" viewBox="0 0 ${tam} ${tam}">
  <rect width="${tam}" height="${tam}" fill="${fondo}"/>
  ${maskable ? '' : `<rect x="0" y="0" width="${tam}" height="${tam}" rx="${tam * 0.22}" fill="#FFC220"/>`}
  <g fill="none" stroke="#041E42" stroke-width="${tam * 0.075}" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="${c}" cy="${c}" r="${r * 0.82}"/>
    <path d="M${c} ${c - r * 0.5}v${r * 0.5}l${r * 0.36} ${r * 0.26}"/>
  </g></svg>`;
};

const salida = [
  ['public/icons/icon-192.png', 192, false],
  ['public/icons/icon-512.png', 512, false],
  ['public/icons/icon-maskable-512.png', 512, true],
  ['public/icons/apple-touch-icon.png', 180, true],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [archivo, tam, mask] of salida) {
  await page.setViewportSize({ width: tam, height: tam });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${icono(tam, mask)}</body></html>`,
  );
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: tam, height: tam } });
  writeFileSync(archivo, png);
  console.log('✓', archivo);
}
await browser.close();
