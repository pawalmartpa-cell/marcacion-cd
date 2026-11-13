import type { Notificacion } from '@/types';

/** Momento en que se abrió la app: solo se avisa de lo que llegue después. */
const INICIO = Date.now();
const avisadas = new Set<string>();

export function avisosSoportados(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function permisoAvisos(): NotificationPermission | 'no-soportado' {
  return avisosSoportados() ? Notification.permission : 'no-soportado';
}

export async function pedirPermisoAvisos(): Promise<NotificationPermission | 'no-soportado'> {
  if (!avisosSoportados()) return 'no-soportado';
  return Notification.requestPermission();
}

/**
 * Devuelve las notificaciones nuevas (llegadas después de abrir la app, sin leer y creadas por otra
 * persona) y las marca como avisadas para no repetirlas.
 */
export function nuevasParaAvisar(datos: Notificacion[], uid: string): Notificacion[] {
  const out: Notificacion[] = [];
  for (const n of datos) {
    if (avisadas.has(n.id)) continue;
    const t = n.creadoEn?.toMillis?.() ?? 0;
    avisadas.add(n.id);
    if (t < INICIO - 5000 || n.creadoPor === uid || n.leidaPor?.includes(uid)) continue;
    out.push(n);
  }
  return out;
}

/** Muestra la notificación del sistema (Android, PC) a través del service worker. */
export async function mostrarAvisoSistema(n: Notificacion, url: string, titulo: string) {
  if (permisoAvisos() !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(titulo, {
      body: n.texto,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: n.id,
      data: { url },
    });
    return true;
  } catch {
    return false;
  }
}

/** Solo para pruebas. */
export function _reiniciarAvisos() {
  avisadas.clear();
}
