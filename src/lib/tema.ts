import { useEffect } from 'react';
import type { ConfigGeneral } from '@/types';

const CLAVE = 'marcacion.tema';
export type Tema = ConfigGeneral['tema'];

export function temaLocal(): Tema | null {
  try {
    const t = localStorage.getItem(CLAVE);
    return t === 'claro' || t === 'oscuro' || t === 'auto' ? t : null;
  } catch {
    return null;
  }
}

export function guardarTemaLocal(t: Tema | null) {
  try {
    if (t) localStorage.setItem(CLAVE, t);
    else localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento */
  }
  window.dispatchEvent(new Event('tema'));
}

function aplicar(t: Tema) {
  const oscuro =
    t === 'oscuro' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', oscuro);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#0B1A33' : '#041E42');
}

/** Aplica el tema: preferencia de este dispositivo o, si no hay, la de Configuración. */
export function useTema(temaGeneral: Tema) {
  useEffect(() => {
    const run = () => aplicar(temaLocal() ?? temaGeneral);
    run();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', run);
    window.addEventListener('tema', run);
    return () => {
      mq.removeEventListener('change', run);
      window.removeEventListener('tema', run);
    };
  }, [temaGeneral]);
}
