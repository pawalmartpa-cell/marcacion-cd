import { defineConfig, devices } from '@playwright/test';

/** Pruebas de punta a punta contra los emuladores (npm run e2e). */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'es-SV',
    timezoneId: 'America/El_Salvador',
    trace: 'off',
    // Teléfono en el CD Hortifruti 5184 (a ~20 m).
    geolocation: { latitude: 13.67328, longitude: -89.2794 },
    permissions: ['geolocation'],
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } } },
  ],
  webServer: {
    command: 'npx vite --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    env: { VITE_USE_EMULATOR: 'true' },
    timeout: 60_000,
  },
});
