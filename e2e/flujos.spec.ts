import { expect, test } from '@playwright/test';
import { entrar } from './util';

test.describe.configure({ mode: 'serial' });

test('el guardia marca la salida con GPS dentro del radio', async ({ page }) => {
  await entrar(page, 'carlos.mendez@test.com');
  await expect(page).toHaveURL(/\/app\/inicio/);
  await expect(page.getByText(/En turno desde/)).toBeVisible();
  await page.getByRole('button', { name: 'Marcar salida' }).click();
  await expect(page.getByText(/Salida registrada ·/)).toBeVisible();
  await expect(page.getByText('Dentro del radio').first()).toBeVisible();
  // Ya no hay jornada abierta: ahora ofrece elegir turno y marcar entrada.
  await expect(page.getByRole('button', { name: 'Marcar entrada' })).toBeVisible();
});

test('sin conexión la marca se guarda en el teléfono y se envía sola al reconectar', async ({
  page,
  context,
}) => {
  await entrar(page, 'ana.rivas@test.com');
  await expect(page.getByRole('button', { name: 'Marcar salida' })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Marcar salida' }).click();
  await expect(page.getByText('Sin conexión · se enviará al reconectar')).toBeVisible();
  await expect(page.getByText(/Salida guardada ·/)).toBeVisible();
  await expect(page.getByLabel(/marcas? pendientes?/)).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByLabel(/marcas? pendientes?/)).toBeHidden({ timeout: 20_000 });
});

test('el admin corrige una jornada con motivo y queda en la bitácora', async ({ page }) => {
  await entrar(page, 'admin.cd@test.com');
  await expect(page).toHaveURL(/\/admin\/resumen/);
  await page.getByRole('link', { name: 'Registros de asistencia' }).click();
  await page.getByRole('tab', { name: 'Esta semana' }).click();
  await page.getByRole('button', { name: /Agregar salida de Sofía Guzmán/ }).click();
  const dlg = page.getByRole('dialog', { name: 'Corregir jornada' });
  await dlg.getByLabel('Hora de salida').fill('1405');
  await dlg.getByRole('button', { name: 'Guardar jornada' }).click();
  await expect(page.getByText('Escribe el motivo antes de guardar')).toBeVisible();
  await dlg.getByRole('button', { name: 'Verificado con hoja de papel' }).click();
  await dlg.getByRole('button', { name: 'Guardar jornada' }).click();
  await expect(page.getByText('Jornada corregida y registrada en la bitácora')).toBeVisible();
  await page.getByRole('link', { name: 'Bitácora' }).click();
  await expect(page.getByText(/Corrigió la jornada de Sofía Guzmán/)).toBeVisible();
  await expect(page.getByText('Motivo: Verificado con hoja de papel').first()).toBeVisible();
});

test('el PA solo ve su CD y no puede corregir horas', async ({ page }) => {
  await entrar(page, 'rosa.h@test.com');
  await expect(page).toHaveURL(/\/pa\/resumen/);
  await page.getByRole('link', { name: 'Registros de asistencia' }).click();
  await page.getByRole('tab', { name: 'Esta semana' }).click();
  await expect(page.getByText('Hortifruti 5184').first()).toBeVisible();
  await expect(page.getByText('Apopa 7417')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Editar jornada' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);
  await page.goto('/pa/usuarios');
  await expect(page).toHaveURL(/\/pa\/resumen/);
});

test('registro con correo → pendiente → el admin aprueba → puede marcar', async ({ browser }) => {
  const correo = `nuevo${Date.now()}@test.com`;
  const g = await browser.newPage();
  await g.goto('/registro');
  await g.getByLabel('Correo').fill(correo);
  await g.getByLabel('Contraseña', { exact: true }).fill('clave-segura-1');
  await g.getByLabel('Repite la contraseña').fill('clave-segura-1');
  await g.getByRole('button', { name: 'Continuar' }).click();
  await expect(g.getByRole('heading', { name: 'Completa tu perfil' })).toBeVisible();
  await g.getByLabel('Nombre').fill('Nuevo');
  await g.getByLabel('Apellidos').fill('Guardia');
  await g.getByLabel('Centro de distribución').selectOption('5184');
  await g.getByRole('radio', { name: /estilo Allura/ }).click();
  await g.getByRole('checkbox').check();
  await g.getByRole('button', { name: 'Guardar perfil' }).click();
  await expect(g.getByRole('heading', { name: 'Esperando aprobación' })).toBeVisible();

  const a = await browser.newPage();
  await entrar(a, 'admin.cd@test.com');
  await a.getByRole('link', { name: /Usuarios/ }).click();
  const fila = a.getByRole('row', { name: /Nuevo Guardia/ });
  await fila.getByRole('button', { name: 'Aprobar' }).click();
  await expect(a.getByText(/Nuevo Guardia aprobado/)).toBeVisible();

  // La pantalla del guardia se actualiza sola.
  await expect(g).toHaveURL(/\/app\/inicio/, { timeout: 15_000 });
  await expect(g.getByRole('button', { name: 'Marcar entrada' })).toBeVisible();
});

test('un usuario bloqueado no puede entrar', async ({ page }) => {
  await entrar(page, 'jose.lopez@test.com');
  await expect(page.getByRole('heading', { name: 'Cuenta bloqueada' })).toBeVisible();
  await page.goto('/app/inicio');
  await expect(page).toHaveURL(/\/bloqueado/);
});

test('el kiosco muestra el QR dinámico y la cuenta regresiva', async ({ page }) => {
  await entrar(page, 'kiosco5184@test.com');
  await expect(page).toHaveURL(/\/kiosco/);
  await expect(page.getByRole('img', { name: 'Código QR vigente para marcar' })).toBeVisible();
  await expect(page.getByText(/cambia en \d+ s/)).toBeVisible();
});

test('el admin edita el CD y el rol de un usuario', async ({ page }) => {
  await entrar(page, 'admin.cd@test.com');
  await page.goto('/admin/usuarios');
  await page.getByRole('tab', { name: /Activos/ }).click();
  await page
    .getByRole('row', { name: /Pedro Ramos/ })
    .getByRole('link', { name: 'Editar' })
    .click();
  await page.getByLabel('Centro de distribución').selectOption('7018');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Cambios guardados')).toBeVisible();
  await page.getByRole('tab', { name: /Activos/ }).click();
  await expect(page.getByRole('row', { name: /Pedro Ramos/ })).toContainText('San Juan Opico 7018');
});

test('el PA abre el detalle de un guardia de su CD', async ({ page }) => {
  await entrar(page, 'rosa.h@test.com');
  await page.goto('/pa/guardia/carlos');
  await expect(page.getByRole('heading', { name: 'Carlos Méndez' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Jornadas' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('row', { name: /· \d+ jornadas?$/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bloquear' })).toHaveCount(0);
});
