import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, usePerfil } from '@/auth/AuthProvider';
import { Icon, Logo, type NombreIcono } from '@/components/Icon';
import { CampanaNotificaciones } from '@/components/Notificaciones';
import { cx } from '@/components/ui';
import { Inicio } from './Inicio';
import { Historial } from './Historial';
import { FirmaGuardia } from './FirmaGuardia';
import { SolicitudesGuardia } from './SolicitudesGuardia';
import { PerfilGuardia } from './PerfilGuardia';

const NAV: Array<[string, string, NombreIcono]> = [
  ['inicio', 'Marcar', 'reloj'],
  ['historial', 'Historial', 'calendario'],
  ['firma', 'Firma', 'firma'],
  ['solicitudes', 'Solicitudes', 'mensaje'],
  ['perfil', 'Perfil', 'persona'],
];

export default function AppGuardia() {
  const p = usePerfil();
  const { config } = useAuth();
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col">
      <header
        className="sticky top-0 z-20 flex items-center gap-2.5 bg-wm-navy px-4 py-3 text-white"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <Logo size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-extrabold">{config.nombreApp}</div>
          <div className="truncate text-[11px] text-[#A9B8D3]">
            {p.nombre} {p.apellidos}
          </div>
        </div>
        <CampanaNotificaciones base="/app" oscuro />
      </header>
      <main className="flex flex-1 flex-col gap-3.5 p-4 pb-28">
        <Routes>
          <Route index element={<Navigate to="inicio" replace />} />
          <Route path="inicio" element={<Inicio />} />
          <Route path="historial" element={<Historial />} />
          <Route path="firma" element={<FirmaGuardia />} />
          <Route path="solicitudes" element={<SolicitudesGuardia />} />
          <Route path="perfil" element={<PerfilGuardia />} />
          <Route path="*" element={<Navigate to="inicio" replace />} />
        </Routes>
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Navegación principal"
      >
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {NAV.map(([to, txt, ic]) => (
            <NavLink
              key={to}
              to={`/app/${to}`}
              className={({ isActive }) =>
                cx(
                  'flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-semibold no-underline',
                  isActive ? '!text-wm-blue dark:!text-info' : '!text-muted',
                )
              }
            >
              <Icon n={ic} size={22} />
              {txt}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
