import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { ToastProvider, Cargando } from '@/components/ui';
import { useTema } from '@/lib/tema';
import { Login } from '@/pages/auth/Login';
import { Registro } from '@/pages/auth/Registro';
import { Recuperar } from '@/pages/auth/Recuperar';
import { CompletarPerfil } from '@/pages/auth/CompletarPerfil';
import { Bloqueado, Pendiente } from '@/pages/auth/Estados';
import { ActualizacionPwa } from '@/components/ActualizacionPwa';
import type { Rol } from '@/types';

const AppGuardia = lazy(() => import('@/pages/guardia/AppGuardia'));
const Kiosco = lazy(() => import('@/pages/kiosco/Kiosco'));
const Panel = lazy(() => import('@/pages/admin/Panel'));

export const INICIO_POR_ROL: Record<Rol, string> = {
  seguridad: '/app',
  kiosco: '/kiosco',
  admin: '/admin',
  pa: '/pa',
};

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <Cargando texto="Abriendo…" />
    </div>
  );
}

/** Decide a dónde va cada usuario según su sesión, perfil, estado y rol. */
function Puerta({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const { cargando, usuario, perfil } = useAuth();
  const loc = useLocation();
  if (cargando) return <Splash />;
  if (!usuario) return <Navigate to="/login" replace state={{ desde: loc.pathname }} />;
  if (!perfil) return <Navigate to="/completar-perfil" replace />;
  if (perfil.estado === 'pendiente') return <Navigate to="/pendiente" replace />;
  if (perfil.estado === 'bloqueado') return <Navigate to="/bloqueado" replace />;
  if (!roles.includes(perfil.rol)) return <Navigate to={INICIO_POR_ROL[perfil.rol]} replace />;
  return <Suspense fallback={<Splash />}>{children}</Suspense>;
}

/** Rutas públicas o intermedias (login, registro, completar perfil, pendiente, bloqueado). */
function Intermedia({
  esperado,
  children,
}: {
  esperado: 'anonimo' | 'sinPerfil' | 'pendiente' | 'bloqueado';
  children: ReactNode;
}) {
  const { cargando, usuario, perfil } = useAuth();
  if (cargando) return <Splash />;
  const actual = !usuario
    ? 'anonimo'
    : !perfil
      ? 'sinPerfil'
      : perfil.estado === 'activo'
        ? 'activo'
        : perfil.estado;
  if (actual === esperado) return <>{children}</>;
  if (actual === 'anonimo') return <Navigate to="/login" replace />;
  if (actual === 'sinPerfil') return <Navigate to="/completar-perfil" replace />;
  if (actual === 'pendiente') return <Navigate to="/pendiente" replace />;
  if (actual === 'bloqueado') return <Navigate to="/bloqueado" replace />;
  return <Navigate to={INICIO_POR_ROL[perfil!.rol]} replace />;
}

function Raiz() {
  const { cargando, usuario, perfil } = useAuth();
  if (cargando) return <Splash />;
  if (!usuario) return <Navigate to="/login" replace />;
  if (!perfil) return <Navigate to="/completar-perfil" replace />;
  if (perfil.estado !== 'activo') return <Navigate to={'/' + perfil.estado} replace />;
  return <Navigate to={INICIO_POR_ROL[perfil.rol]} replace />;
}

function Rutas() {
  const { config } = useAuth();
  useTema(config.tema);
  useEffect(() => {
    document.title = config.nombreApp;
  }, [config.nombreApp]);
  return (
    <Routes>
      <Route path="/" element={<Raiz />} />
      <Route
        path="/login"
        element={
          <Intermedia esperado="anonimo">
            <Login />
          </Intermedia>
        }
      />
      <Route
        path="/registro"
        element={
          <Intermedia esperado="anonimo">
            <Registro />
          </Intermedia>
        }
      />
      <Route path="/recuperar" element={<Recuperar />} />
      <Route
        path="/completar-perfil"
        element={
          <Intermedia esperado="sinPerfil">
            <CompletarPerfil />
          </Intermedia>
        }
      />
      <Route
        path="/pendiente"
        element={
          <Intermedia esperado="pendiente">
            <Pendiente />
          </Intermedia>
        }
      />
      <Route
        path="/bloqueado"
        element={
          <Intermedia esperado="bloqueado">
            <Bloqueado />
          </Intermedia>
        }
      />
      <Route
        path="/app/*"
        element={
          <Puerta roles={['seguridad']}>
            <AppGuardia />
          </Puerta>
        }
      />
      <Route
        path="/kiosco"
        element={
          <Puerta roles={['kiosco']}>
            <Kiosco />
          </Puerta>
        }
      />
      <Route
        path="/admin/*"
        element={
          <Puerta roles={['admin']}>
            <Panel base="/admin" />
          </Puerta>
        }
      />
      <Route
        path="/pa/*"
        element={
          <Puerta roles={['pa']}>
            <Panel base="/pa" />
          </Puerta>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true }}>
      <ToastProvider>
        <AuthProvider>
          <Rutas />
          <ActualizacionPwa />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
