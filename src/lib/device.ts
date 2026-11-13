const CLAVE = 'marcacion.deviceId';

function aleatorio(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'd-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Identificador local del teléfono. Se crea una vez y queda guardado en el navegador. */
export function obtenerDeviceId(): string {
  try {
    let id = localStorage.getItem(CLAVE);
    if (!id) {
      id = aleatorio();
      localStorage.setItem(CLAVE, id);
    }
    return id;
  } catch {
    return 'sin-almacenamiento';
  }
}

export function nombreDispositivo(): string {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad/i.test(ua)) return 'iPhone';
  if (/windows/i.test(ua)) return 'Windows';
  if (/mac/i.test(ua)) return 'Mac';
  return 'Navegador';
}
