import { execSync } from 'node:child_process';

export default async function globalSetup() {
  // Borra y vuelve a sembrar el emulador para que cada corrida empiece igual.
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
  await fetch(`http://${host}/emulator/v1/projects/demo-marcacion/databases/(default)/documents`, {
    method: 'DELETE',
  });
  await fetch(`http://${authHost}/emulator/v1/projects/demo-marcacion/accounts`, { method: 'DELETE' });
  execSync('node scripts/seed-emulator.mjs', {
    stdio: 'inherit',
    env: { ...process.env, FIRESTORE_EMULATOR_HOST: host, FIREBASE_AUTH_EMULATOR_HOST: authHost },
  });
}
