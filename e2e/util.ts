import { expect, type Page } from '@playwright/test';

export async function entrar(page: Page, email: string, password = '12345678') {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  // Espera a que termine el inicio de sesión antes de seguir navegando.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}
