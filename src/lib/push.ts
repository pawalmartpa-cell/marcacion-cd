import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { auth, db } from './firebase';
import { nombreDispositivo } from './device';

/**
 * Notificaciones push reales (llegan aunque la app esté cerrada):
 *  - El teléfono se registra en FCM y guarda su token en `tokensPush/{token}`.
 *  - Después de crear un aviso, la app le pide al Worker de Cloudflare que lo envíe.
 *  - La dirección del Worker la publica el workflow `avisos` en `config/push` (lectura pública).
 */

const CLAVE_TOKEN = 'marcacion.pushToken';
const usarEmulador = import.meta.env.VITE_USE_EMULATOR === 'true';
let configCache: Promise<{ url: string } | null> | null = null;

export function configPush(): Promise<{ url: string } | null> {
  if (usarEmulador) return Promise.resolve(null);
  configCache ??= getDoc(doc(db, 'config', 'push'))
    .then((s) =>
      s.exists() && typeof s.data().url === 'string' && s.data().url ? { url: String(s.data().url) } : null,
    )
    .catch(() => null);
  return configCache;
}

export async function pushDisponible(): Promise<boolean> {
  if (
    usarEmulador ||
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator)
  )
    return false;
  try {
    return (await isSupported()) && (await configPush()) != null;
  } catch {
    return false;
  }
}

function conTiempo<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('tiempo agotado')), ms)),
  ]);
}

async function obtenerToken(): Promise<string> {
  const reg = await conTiempo(navigator.serviceWorker.ready, 10_000);
  return getToken(getMessaging(getApp()), { serviceWorkerRegistration: reg });
}

export type ResultadoPush = 'ok' | 'denegado' | 'no-disponible' | 'error';

/** Pide permiso (si hace falta), registra este teléfono y guarda su token. */
export async function activarPush(uid: string, pedirPermiso = true): Promise<ResultadoPush> {
  if (!(await pushDisponible())) return 'no-disponible';
  let permiso = Notification.permission;
  if (permiso === 'default' && pedirPermiso) permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return permiso === 'denied' ? 'denegado' : 'no-disponible';
  try {
    const token = await obtenerToken();
    await setDoc(doc(db, 'tokensPush', token), {
      uid,
      dispositivo: nombreDispositivo(),
      actualizadoEn: serverTimestamp(),
    });
    try {
      localStorage.setItem(CLAVE_TOKEN, token);
    } catch {
      /* sin almacenamiento */
    }
    return 'ok';
  } catch (e) {
    console.warn('No se pudo activar push', e);
    return 'error';
  }
}

/** ¿Este teléfono ya tiene avisos push activos? */
export function pushActivoLocal(): boolean {
  try {
    return (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' &&
      !!localStorage.getItem(CLAVE_TOKEN)
    );
  } catch {
    return false;
  }
}

/** Al cerrar sesión: este teléfono deja de recibir los avisos de esa cuenta. */
export async function desactivarPush() {
  let token: string | null = null;
  try {
    token = localStorage.getItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    /* */
  }
  if (!token) return;
  await Promise.allSettled([
    deleteDoc(doc(db, 'tokensPush', token)),
    (async () => {
      if (await isSupported()) await deleteToken(getMessaging(getApp()));
    })(),
  ]);
}

/** Pide al Worker que envíe ya los avisos pendientes (si falla, el Worker lo hace en ≤ 1 min). */
export function avisarPush() {
  void (async () => {
    try {
      const cfg = await configPush();
      const u = auth.currentUser;
      if (!cfg || !u) return;
      const idToken = await u.getIdToken();
      await fetch(`${cfg.url.replace(/\/$/, '')}/enviar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
        keepalive: true,
      });
    } catch {
      /* el cron del Worker lo reintenta */
    }
  })();
}
