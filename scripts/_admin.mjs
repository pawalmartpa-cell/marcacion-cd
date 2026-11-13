// Inicializa firebase-admin con el secreto FIREBASE_SERVICE_ACCOUNT (JSON) o con el emulador.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

export function iniciar() {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-marcacion' });
  } else {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      console.error('Falta el secreto FIREBASE_SERVICE_ACCOUNT (JSON de la cuenta de servicio).');
      process.exit(1);
    }
    let cuenta;
    try {
      cuenta = JSON.parse(raw);
    } catch {
      console.error(
        'FIREBASE_SERVICE_ACCOUNT no es un JSON válido. Copia el archivo completo, desde { hasta }.',
      );
      process.exit(1);
    }
    initializeApp({ credential: cert(cuenta), projectId: cuenta.project_id });
  }
  return { db: getFirestore(), auth: getAuth() };
}

/** 'yyyy-MM-dd' en El Salvador (UTC-6 fijo). */
export function fechaSV(d = new Date()) {
  return new Date(d.getTime() - 6 * 3600 * 1000).toISOString().slice(0, 10);
}
