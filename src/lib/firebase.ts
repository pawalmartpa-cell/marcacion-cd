import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const env = import.meta.env;
const usarEmulador = env.VITE_USE_EMULATOR === 'true';

export const firebaseConfigurado = Boolean(env.VITE_FIREBASE_API_KEY) || usarEmulador;

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY || 'demo-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-marcacion.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'demo-marcacion',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
  appId: env.VITE_FIREBASE_APP_ID || undefined,
});

export const auth = getAuth(app);
auth.languageCode = 'es';
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Persistencia sin conexión: las marcas se guardan en el teléfono y se envían al reconectar.
export const db = initializeFirestore(app, {
  localCache:
    typeof window !== 'undefined' && 'indexedDB' in window
      ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      : undefined,
});

if (usarEmulador) {
  const host = env.VITE_EMULATOR_HOST || '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}
