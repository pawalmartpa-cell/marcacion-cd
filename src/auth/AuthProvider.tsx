import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ref } from '@/data/refs';
import { useDocumento } from '@/data/hooks';
import { CONFIG_POR_DEFECTO, type ConfigGeneral, type Usuario } from '@/types';

interface AuthCtx {
  /** true mientras se resuelve la sesión o el perfil. */
  cargando: boolean;
  usuario: User | null;
  perfil: Usuario | null;
  config: ConfigGeneral;
  salir: () => Promise<void>;
  recargarUsuario: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [authListo, setAuthListo] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUsuario(u);
        setAuthListo(true);
      }),
    [],
  );

  const perfilDoc = useDocumento<Usuario>(usuario ? ref.user(usuario.uid) : null);
  const configDoc = useDocumento<ConfigGeneral>(ref.config());

  const valor = useMemo<AuthCtx>(
    () => ({
      cargando: !authListo || (!!usuario && perfilDoc.cargando),
      usuario,
      perfil: perfilDoc.datos ? { ...perfilDoc.datos, uid: perfilDoc.datos.id } : null,
      config: { ...CONFIG_POR_DEFECTO, ...(configDoc.datos ?? {}) },
      salir: () => signOut(auth),
      recargarUsuario: async () => {
        await auth.currentUser?.reload();
        // Renueva el token para que las reglas vean email_verified actualizado.
        await auth.currentUser?.getIdToken(true);
        setVersion((v) => v + 1);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authListo, usuario, perfilDoc.cargando, perfilDoc.datos, configDoc.datos, version],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fuera de AuthProvider');
  return c;
}

/** Perfil garantizado (usar solo dentro de rutas protegidas). */
export function usePerfil(): Usuario {
  const { perfil } = useAuth();
  if (!perfil) throw new Error('Sin perfil');
  return perfil;
}

export function nombreCompleto(u: Pick<Usuario, 'nombre' | 'apellidos'> | null | undefined): string {
  return u ? `${u.nombre} ${u.apellidos}`.trim() : '';
}
