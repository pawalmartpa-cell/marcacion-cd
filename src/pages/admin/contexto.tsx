import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { usePerfil } from '@/auth/AuthProvider';
import { useAlertas, useCds, useUsuarios } from '@/data/consultas';
import { actorDe, type Actor } from '@/data/servicios';
import type { Alerta, Cd, Usuario } from '@/types';
import type { ConId } from '@/data/hooks';

interface PanelCtx {
  base: string;
  esAdmin: boolean;
  /** Filtro elegido arriba (solo admin). */
  cdFiltro: string | null;
  setCdFiltro: (v: string | null) => void;
  /** CD efectivo para consultas: el del PA o el filtro del admin (null = todos). */
  alcance: string | null;
  cds: Cd[];
  cargandoCds: boolean;
  usuarios: Usuario[];
  cargandoUsuarios: boolean;
  usuario: (uid: string) => Usuario | undefined;
  cd: (id: string) => Cd | undefined;
  cdNombre: (id: string | null | undefined) => string;
  alertasAbiertas: Array<ConId<Alerta>>;
  actor: Actor;
  /** Ruta absoluta dentro del panel. */
  r: (p: string) => string;
}

const Ctx = createContext<PanelCtx | null>(null);

export function PanelProvider({ base, children }: { base: string; children: ReactNode }) {
  const p = usePerfil();
  const esAdmin = p.rol === 'admin';
  const [cdFiltro, setCdFiltro] = useState<string | null>(null);
  const alcance = esAdmin ? cdFiltro : p.cdId;
  const cds = useCds();
  // Usuarios: el admin carga todos (para el filtro local); el PA solo su CD.
  const usuarios = useUsuarios(esAdmin ? null : p.cdId);
  const alertas = useAlertas(esAdmin ? null : p.cdId, { estado: 'abierta', max: 200 });

  const valor = useMemo<PanelCtx>(() => {
    const mu = new Map(usuarios.datos.map((u) => [u.uid, u]));
    const mc = new Map(cds.datos.map((c) => [c.id, c]));
    return {
      base,
      esAdmin,
      cdFiltro,
      setCdFiltro,
      alcance,
      cds: esAdmin ? cds.datos : cds.datos.filter((c) => c.id === p.cdId),
      cargandoCds: cds.cargando,
      usuarios: usuarios.datos.filter((u) => !alcance || u.cdId === alcance),
      cargandoUsuarios: usuarios.cargando,
      usuario: (uid) => mu.get(uid),
      cd: (id) => mc.get(id),
      cdNombre: (id) => {
        if (!id) return 'Todos los CD';
        const c = mc.get(id);
        return c ? `${c.nombre} ${c.codigo}` : id;
      },
      alertasAbiertas: alertas.datos.filter((a) => !alcance || a.cdId === alcance),
      actor: actorDe(p),
      r: (x) => `${base}/${x}`.replace(/\/+$/, ''),
    };
  }, [
    base,
    esAdmin,
    cdFiltro,
    alcance,
    cds.datos,
    cds.cargando,
    usuarios.datos,
    usuarios.cargando,
    alertas.datos,
    p,
  ]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function usePanel(): PanelCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePanel fuera del panel');
  return c;
}
