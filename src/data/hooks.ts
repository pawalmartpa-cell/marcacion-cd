import { useEffect, useRef, useState } from 'react';
import {
  onSnapshot,
  queryEqual,
  refEqual,
  type DocumentData,
  type DocumentReference,
  type Query,
} from 'firebase/firestore';

export type ConId<T> = T & { id: string; _pendiente?: boolean };

interface Estado<T> {
  datos: T;
  cargando: boolean;
  error: Error | null;
  desdeCache: boolean;
}

function useEstable<T extends Query | DocumentReference | null>(
  v: T,
  eq: (a: NonNullable<T>, b: NonNullable<T>) => boolean,
): T {
  const ref = useRef(v);
  const a = ref.current;
  if (a !== v && (a == null || v == null || !eq(a as NonNullable<T>, v as NonNullable<T>))) ref.current = v;
  return ref.current;
}

/** Suscripción en vivo a una consulta. Con `serverTimestamps: 'estimate'` las marcas sin conexión se ven al instante. */
export function useConsulta<T = DocumentData>(q: Query | null): Estado<Array<ConId<T>>> {
  const estable = useEstable(q, queryEqual);
  const [st, setSt] = useState<Estado<Array<ConId<T>>> & { para: Query | null }>({
    datos: [],
    cargando: !!q,
    error: null,
    desdeCache: false,
    para: q,
  });
  useEffect(() => {
    if (!estable) {
      setSt({ datos: [], cargando: false, error: null, desdeCache: false, para: null });
      return;
    }
    setSt((s) => ({ ...s, cargando: true, error: null, para: estable }));
    return onSnapshot(
      estable,
      { includeMetadataChanges: true },
      (snap) => {
        setSt({
          para: estable,
          datos: snap.docs.map((d) => ({
            ...(d.data({ serverTimestamps: 'estimate' }) as T),
            id: d.id,
            _pendiente: d.metadata.hasPendingWrites,
          })),
          cargando: false,
          error: null,
          desdeCache: snap.metadata.fromCache,
        });
      },
      (error) => {
        console.error(error);
        setSt({ datos: [], cargando: false, error, desdeCache: false, para: estable });
      },
    );
  }, [estable]);
  // Si la consulta cambió y el efecto aún no corre, todavía estamos cargando.
  return { ...st, cargando: st.cargando || (!!estable && st.para !== estable) };
}

export function useDocumento<T = DocumentData>(
  ref: DocumentReference | null,
): Estado<ConId<T> | null> & { existe: boolean } {
  const estable = useEstable(ref, refEqual);
  const [st, setSt] = useState<Estado<ConId<T> | null> & { existe: boolean; para: DocumentReference | null }>(
    {
      datos: null,
      cargando: !!ref,
      error: null,
      desdeCache: false,
      existe: false,
      para: ref,
    },
  );
  useEffect(() => {
    if (!estable) {
      setSt({ datos: null, cargando: false, error: null, desdeCache: false, existe: false, para: null });
      return;
    }
    setSt((s) => ({ ...s, cargando: true, para: estable }));
    return onSnapshot(
      estable,
      { includeMetadataChanges: true },
      (d) => {
        setSt({
          para: estable,
          datos: d.exists()
            ? {
                ...(d.data({ serverTimestamps: 'estimate' }) as T),
                id: d.id,
                _pendiente: d.metadata.hasPendingWrites,
              }
            : null,
          existe: d.exists(),
          cargando: false,
          error: null,
          desdeCache: d.metadata.fromCache,
        });
      },
      (error) => {
        console.error(error);
        setSt({ datos: null, cargando: false, error, desdeCache: false, existe: false, para: estable });
      },
    );
  }, [estable]);
  return { ...st, cargando: st.cargando || (!!estable && st.para !== estable) };
}

/** Estado de la conexión del navegador. */
export function useEnLinea(): boolean {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true);
    const b = () => setOn(false);
    window.addEventListener('online', a);
    window.addEventListener('offline', b);
    return () => {
      window.removeEventListener('online', a);
      window.removeEventListener('offline', b);
    };
  }, []);
  return on;
}

/** Re-renderiza cada `ms` (para relojes y cuentas regresivas). */
export function useAhora(ms = 1000): Date {
  const [d, setD] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setD(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return d;
}
