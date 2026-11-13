import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { entrar } from './util';

async function revisar(page: Page, nombre: string) {
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    // Los mosaicos del mapa son de un tercero.
    .exclude('.leaflet-container')
    .analyze();
  const graves = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  for (const v of graves)
    console.log(
      `[${nombre}] ${v.id}: ${v.help} → ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 3)
        .join(' | ')}`,
    );
  expect(graves, `${nombre}: problemas de accesibilidad graves`).toEqual([]);
}

test('accesibilidad: login', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await revisar(page, 'login');
});

test('accesibilidad: app del guardia (claro y oscuro)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await entrar(page, 'maria.perez@test.com');
  await expect(page.getByText('Esta semana')).toBeVisible();
  await revisar(page, 'guardia');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(300);
  await revisar(page, 'guardia-oscuro');
});

test('accesibilidad: panel admin', async ({ page }) => {
  await entrar(page, 'admin.cd@test.com');
  await expect(page.getByText('Alertas abiertas').first()).toBeVisible();
  await revisar(page, 'resumen');
  await page.goto('/admin/asistencia');
  await page.getByRole('tab', { name: 'Esta semana' }).click();
  await expect(page.getByText(/jornadas?$/).first()).toBeVisible();
  await revisar(page, 'asistencia');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(300);
  await revisar(page, 'asistencia-oscuro');
});
