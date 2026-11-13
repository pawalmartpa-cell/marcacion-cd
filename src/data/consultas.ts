import { useMemo } from 'react';
import { limit, orderBy, query, where, type QueryConstraint } from 'firebase/firestore';
import { col } from './refs';
import { useConsulta } from './hooks';
import type {
  Alerta,
  Cd,
  EntradaBitacora,
  Invitacion,
  Jornada,
  Notificacion,
  ReporteGenerado,
  Solicitud,
  Usuario,
} from '@/types';
import { useAuth } from '@/auth/AuthProvider';

/**
 * Todas las consultas de la app están aquí para que coincidan con firestore.indexes.json.
 * Regla de oro: las reglas no filtran, así que PA siempre consulta con where('cdId','==',suCd)
 * y el guardia siempre con where('uid','==',suUid).
 */

export function useCds() {
  const { usuario } = useAuth();
  const q = useMemo(() => (usuario ? query(col.cds(), orderBy('nombre')) : null), [usuario]);
  const r = useConsulta<Cd>(q);
  return { ...r, datos: r.datos.map((c) => ({ ...c, id: c.id })) };
}

/** cdId fijo para PA; null = todos (admin). */
export function useAlcance(cdFiltro: string | null): string | null {
  const { perfil } = useAuth();
  if (perfil?.rol === 'pa') return perfil.cdId;
  return cdFiltro;
}

export function useJornadaAbierta(uid: string | null) {
  const q = useMemo(
    () => (uid ? query(col.jornadas(), where('uid', '==', uid), where('estado', '==', 'abierta')) : null),
    [uid],
  );
  return useConsulta<Jornada>(q);
}

/** Jornadas de un guardia. El PA debe pasar `cdId` (las reglas exigen filtrar por su CD). */
export function useJornadasDeGuardia(
  uid: string | null,
  desde: string,
  hasta?: string,
  cdId?: string | null,
) {
  const q = useMemo(() => {
    if (!uid) return null;
    const c: QueryConstraint[] = [];
    if (cdId) c.push(where('cdId', '==', cdId));
    c.push(where('uid', '==', uid), where('fecha', '>=', desde));
    if (hasta) c.push(where('fecha', '<=', hasta));
    return query(col.jornadas(), ...c, orderBy('fecha', 'desc'));
  }, [uid, desde, hasta, cdId]);
  return useConsulta<Jornada>(q);
}

/** Jornadas por rango de fechas. PA: siempre su CD. */
export function useJornadas(cdId: string | null, desde: string, hasta: string) {
  const { perfil } = useAuth();
  const q = useMemo(() => {
    if (!perfil) return null;
    const c: QueryConstraint[] = [];
    if (cdId) c.push(where('cdId', '==', cdId));
    c.push(where('fecha', '>=', desde), where('fecha', '<=', hasta), orderBy('fecha', 'desc'));
    return query(col.jornadas(), ...c);
  }, [perfil, cdId, desde, hasta]);
  return useConsulta<Jornada>(q);
}

/** Para la pantalla del kiosco: jornadas de su CD desde ayer. */
export function useJornadasKiosco(cdId: string, desde: string) {
  const q = useMemo(
    () =>
      query(col.jornadas(), where('cdId', '==', cdId), where('fecha', '>=', desde), orderBy('fecha', 'desc')),
    [cdId, desde],
  );
  return useConsulta<Jornada>(q);
}

export function useAlertas(cdId: string | null, opts: { estado?: 'abierta'; max?: number } = {}) {
  const { estado, max = 300 } = opts;
  const q = useMemo(() => {
    const c: QueryConstraint[] = [];
    if (cdId) c.push(where('cdId', '==', cdId));
    if (estado) c.push(where('estado', '==', estado));
    c.push(orderBy('creadoEn', 'desc'), limit(max));
    return query(col.alertas(), ...c);
  }, [cdId, estado, max]);
  return useConsulta<Alerta>(q);
}

export function useUsuarios(cdId: string | null) {
  const { perfil } = useAuth();
  const q = useMemo(() => {
    if (!perfil) return null;
    return cdId ? query(col.users(), where('cdId', '==', cdId)) : query(col.users());
  }, [perfil, cdId]);
  const r = useConsulta<Usuario>(q);
  return { ...r, datos: r.datos.map((u) => ({ ...u, uid: u.id })) };
}

export function useBitacora(cdId: string | null, desde: Date, hasta: Date) {
  const q = useMemo(() => {
    const c: QueryConstraint[] = [];
    if (cdId) c.push(where('cdId', '==', cdId));
    c.push(where('fecha', '>=', desde), where('fecha', '<=', hasta), orderBy('fecha', 'desc'), limit(500));
    return query(col.bitacora(), ...c);
  }, [cdId, desde, hasta]);
  return useConsulta<EntradaBitacora>(q);
}

export function useNotificaciones() {
  const { perfil } = useAuth();
  const q = useMemo(() => {
    if (!perfil || perfil.estado !== 'activo') return null;
    if (perfil.rol === 'admin')
      return query(
        col.notificaciones(),
        where('para', 'in', ['staff', 'admin']),
        orderBy('creadoEn', 'desc'),
        limit(40),
      );
    if (perfil.rol === 'pa')
      return query(
        col.notificaciones(),
        where('para', '==', 'staff'),
        where('cdId', '==', perfil.cdId),
        orderBy('creadoEn', 'desc'),
        limit(40),
      );
    return query(
      col.notificaciones(),
      where('para', '==', 'usuario'),
      where('uid', '==', perfil.uid),
      orderBy('creadoEn', 'desc'),
      limit(40),
    );
  }, [perfil]);
  return useConsulta<Notificacion>(q);
}

export function useSolicitudes(alcance: { uid?: string; cdId?: string | null }) {
  const { uid, cdId } = alcance;
  const q = useMemo(() => {
    if (uid) return query(col.solicitudes(), where('uid', '==', uid), orderBy('creadoEn', 'desc'), limit(50));
    if (cdId)
      return query(col.solicitudes(), where('cdId', '==', cdId), orderBy('creadoEn', 'desc'), limit(100));
    return query(col.solicitudes(), orderBy('creadoEn', 'desc'), limit(100));
  }, [uid, cdId]);
  return useConsulta<Solicitud>(q);
}

export function useReportes(cdId: string | null) {
  const q = useMemo(
    () =>
      cdId
        ? query(col.reportes(), where('cdId', '==', cdId), orderBy('fecha', 'desc'), limit(30))
        : query(col.reportes(), orderBy('fecha', 'desc'), limit(30)),
    [cdId],
  );
  return useConsulta<ReporteGenerado>(q);
}

export function useInvitaciones(activo: boolean) {
  const q = useMemo(() => (activo ? query(col.invitaciones(), orderBy('creadoEn', 'desc')) : null), [activo]);
  return useConsulta<Invitacion>(q);
}
