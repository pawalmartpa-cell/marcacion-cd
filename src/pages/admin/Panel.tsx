import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth, usePerfil, nombreCompleto } from '@/auth/AuthProvider';
import { Icon, Logo, type NombreIcono } from '@/components/Icon';
import { CampanaNotificaciones } from '@/components/Notificaciones';
import { Avatar, Pill, cx } from '@/components/ui';
import { BannerConexion } from '@/components/BannerConexion';
import { PanelProvider, usePanel } from './contexto';
import { Resumen } from './Resumen';
import { Asistencia } from './Asistencia';
import { GuardiaDetalle } from './GuardiaDetalle';
import { Usuarios, UsuarioForm } from './Usuarios';
import { Cds, CdDetalle } from './Cds';
import { Alertas, AlertaDetalle } from './Alertas';
import { Reportes } from './Reportes';
import { KioscoQr } from './KioscoQr';
import { Firmas } from './Firmas';
import { Bitacora } from './Bitacora';
import { Configuracion } from './Configuracion';
import { PerfilPanel } from './PerfilPanel';
import { Solicitudes } from './Solicitudes';

interface ItemNav {
  to: string;
  txt: string;
  ic: NombreIcono;
  badge?: number;
  soloAdmin?: boolean;
}

function Lateral({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const p = usePerfil();
  const { config } = useAuth();
  const { esAdmin, usuarios, alertasAbiertas, r, cdNombre } = usePanel();
  const pendientes = usuarios.filter((u) => u.estado === 'pendiente').length;
  const items: ItemNav[] = [
    { to: 'resumen', txt: 'Resumen', ic: 'home' },
    { to: 'asistencia', txt: 'Registros de asistencia', ic: 'reloj' },
    { to: 'usuarios', txt: 'Usuarios', ic: 'users', badge: pendientes, soloAdmin: true },
    { to: 'cds', txt: 'Centros de distribución', ic: 'cd', soloAdmin: true },
    { to: 'alertas', txt: 'Alertas', ic: 'alerta', badge: alertasAbiertas.length },
    { to: 'solicitudes', txt: 'Solicitudes', ic: 'mensaje' },
    { to: 'reportes', txt: 'Reportes', ic: 'archivo' },
    { to: 'qr', txt: 'Kiosco QR', ic: 'qr' },
    { to: 'firmas', txt: 'Firmas', ic: 'firma' },
    { to: 'bitacora', txt: 'Bitácora', ic: 'libro' },
    { to: 'config', txt: 'Configuración', ic: 'engrane', soloAdmin: true },
  ];
  return (
    <>
      {abierto && (
        <div className="fixed inset-0 z-[29] bg-black/40 lg:hidden" onClick={onCerrar} aria-hidden />
      )}
      <aside
        id="menu-lateral"
        className={cx(
          'fixed left-0 top-0 z-30 flex h-screen w-[250px] shrink-0 flex-col gap-[3px] overflow-auto bg-wm-navy px-3 py-5 text-white transition-transform lg:sticky lg:translate-x-0',
          abierto ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Menú del panel"
      >
        <div className="flex items-center gap-2.5 px-2 pb-4">
          <Logo />
          <div>
            <div className="text-base font-extrabold">{config.nombreApp}</div>
            <div className="text-[11px] text-[#A9B8D3]">{esAdmin ? 'Administrador' : 'Coordinador (PA)'}</div>
          </div>
        </div>
        <nav className="flex flex-col gap-[3px]">
          {items
            .filter((i) => esAdmin || !i.soloAdmin)
            .map((i) => (
              <NavLink
                key={i.to}
                to={r(i.to)}
                onClick={onCerrar}
                className={({ isActive }) =>
                  cx(
                    'flex min-h-[42px] items-center justify-between gap-2.5 rounded-[10px] px-3 font-semibold no-underline',
                    isActive
                      ? '!bg-wm-blue !text-white'
                      : '!text-[#C9D4E6] hover:!bg-wm-navy2 hover:!text-white',
                  )
                }
              >
                <span className="flex items-center gap-2.5">
                  <Icon n={i.ic} />
                  {i.txt}
                </span>
                {!!i.badge && (
                  <span className="rounded-full bg-wm-yellow px-2 py-px text-xs font-extrabold text-wm-navy">
                    {i.badge}
                  </span>
                )}
              </NavLink>
            ))}
        </nav>
        <Link
          to={r('perfil')}
          onClick={onCerrar}
          className="mt-auto flex items-center gap-2.5 border-t border-[#1F3E6E] px-2 pb-1 pt-3 !text-white no-underline"
        >
          <Avatar nombre={p.nombre} apellidos={p.apellidos} />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold">{nombreCompleto(p)}</span>
            <span className="block truncate text-[11px] text-[#A9B8D3]">
              {esAdmin ? 'Todos los CD' : cdNombre(p.cdId)}
            </span>
          </span>
        </Link>
      </aside>
    </>
  );
}

const AbrirMenu = createContext<() => void>(() => {});

/** Encabezado de cada pantalla, con el filtro por CD (admin) igual que en el prototipo. */
export function Encabezado({
  titulo,
  sub,
  crumb,
  acciones,
  sinFiltro,
}: {
  titulo: ReactNode;
  sub?: ReactNode;
  crumb?: ReactNode;
  acciones?: ReactNode;
  sinFiltro?: boolean;
}) {
  const { esAdmin, cds, cdFiltro, setCdFiltro, base } = usePanel();
  const abrirMenu = useContext(AbrirMenu);
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-line bg-card lg:hidden"
          aria-label="Abrir menú"
          aria-controls="menu-lateral"
          onClick={abrirMenu}
        >
          <Icon n="menu" size={20} />
        </button>
        <div>
          {crumb && <div className="mb-1 text-[13px] text-muted">{crumb}</div>}
          <h1>{titulo}</h1>
          {sub && <div className="mt-1 text-muted">{sub}</div>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {acciones}
        {!acciones && !sinFiltro && esAdmin && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por CD">
            <Pill activo={cdFiltro === null} onClick={() => setCdFiltro(null)}>
              Todos los CD
            </Pill>
            {cds.map((c) => (
              <Pill key={c.id} activo={cdFiltro === c.id} onClick={() => setCdFiltro(c.id)}>
                CD {c.codigo}
              </Pill>
            ))}
          </div>
        )}
        <CampanaNotificaciones base={base} />
      </div>
    </div>
  );
}

function Contenido({ base }: { base: string }) {
  const [abierto, setAbierto] = useState(false);
  const loc = useLocation();
  const { esAdmin } = usePanel();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  const soloAdmin = (el: ReactNode) => (esAdmin ? el : <Navigate to={`${base}/resumen`} replace />);
  return (
    <AbrirMenu.Provider value={() => setAbierto(true)}>
      <div className="flex min-h-screen">
        <Lateral abierto={abierto} onCerrar={() => setAbierto(false)} />
        <main className="min-w-0 flex-1 px-4 pb-12 pt-4 sm:px-7 sm:pt-6">
          <div className="mb-3">
            <BannerConexion />
          </div>
          <Routes>
            <Route index element={<Navigate to="resumen" replace />} />
            <Route path="resumen" element={<Resumen />} />
            <Route path="asistencia" element={<Asistencia />} />
            <Route path="guardia/:uid" element={<GuardiaDetalle />} />
            <Route path="usuarios" element={soloAdmin(<Usuarios />)} />
            <Route path="usuarios/nuevo" element={soloAdmin(<UsuarioForm />)} />
            <Route path="usuarios/:uid/editar" element={soloAdmin(<UsuarioForm />)} />
            <Route path="cds" element={soloAdmin(<Cds />)} />
            <Route path="cds/nuevo" element={soloAdmin(<CdDetalle nuevo />)} />
            <Route path="cds/:id" element={soloAdmin(<CdDetalle />)} />
            <Route path="alertas" element={<Alertas />} />
            <Route path="alertas/:id" element={<AlertaDetalle />} />
            <Route path="solicitudes" element={<Solicitudes />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="qr" element={<KioscoQr />} />
            <Route path="firmas" element={<Firmas />} />
            <Route path="bitacora" element={<Bitacora />} />
            <Route path="config" element={soloAdmin(<Configuracion />)} />
            <Route path="perfil" element={<PerfilPanel />} />
            <Route path="*" element={<Navigate to="resumen" replace />} />
          </Routes>
        </main>
      </div>
    </AbrirMenu.Provider>
  );
}

export default function Panel({ base }: { base: string }) {
  return (
    <PanelProvider base={base}>
      <Contenido base={base} />
    </PanelProvider>
  );
}
