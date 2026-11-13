import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useNotificaciones } from '@/data/consultas';
import { marcarLeida } from '@/data/servicios';
import { haceTexto } from '@/lib/fechas';
import { Icon } from './Icon';
import { Button, Dialog, Vacio, cx, useToast } from './ui';
import {
  avisosSoportados,
  mostrarAvisoSistema,
  nuevasParaAvisar,
  pedirPermisoAvisos,
  permisoAvisos,
} from '@/lib/avisos';
import { activarPush, pushActivoLocal } from '@/lib/push';

let pushRefrescado = false;

export function CampanaNotificaciones({ base, oscuro }: { base: string; oscuro?: boolean }) {
  const { perfil, config } = useAuth();
  const { datos } = useNotificaciones();
  const [abierto, setAbierto] = useState(false);
  const [permiso, setPermiso] = useState(permisoAvisos);
  const [pushOk, setPushOk] = useState(pushActivoLocal);
  const [activando, setActivando] = useState(false);
  const nav = useNavigate();
  const toast = useToast();

  // Una vez por sesión: si ya dio permiso, renueva el registro de este teléfono para los avisos push.
  useEffect(() => {
    if (!perfil || pushRefrescado || permisoAvisos() !== 'granted') return;
    pushRefrescado = true;
    activarPush(perfil.uid, false).then((r) => r === 'ok' && setPushOk(true));
  }, [perfil]);

  // Aviso en vivo de lo nuevo: notificación del teléfono si la app está en segundo plano,
  // o un aviso dentro de la app si está abierta.
  useEffect(() => {
    if (!perfil) return;
    for (const n of nuevasParaAvisar(datos, perfil.uid)) {
      const url = `${base}/${n.enlace ?? ''}`.replace(/\/$/, '');
      if (document.visibilityState === 'hidden') mostrarAvisoSistema(n, url, config.nombreApp);
      else toast(n.texto);
    }
  }, [datos, perfil, base, config.nombreApp, toast]);

  if (!perfil) return null;
  const sinLeer = datos.filter((n) => !n.leidaPor?.includes(perfil.uid));
  return (
    <>
      <button
        type="button"
        className={cx(
          'relative flex h-11 w-11 items-center justify-center rounded-[10px]',
          oscuro ? 'text-white hover:bg-wm-navy2' : 'border border-line bg-card hover:bg-track',
        )}
        aria-label={`Notificaciones${sinLeer.length ? `: ${sinLeer.length} sin leer` : ''}`}
        onClick={() => setAbierto(true)}
      >
        <Icon n="campana" size={20} />
        {sinLeer.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[20px] rounded-full bg-wm-yellow px-1 text-[11px] font-extrabold text-wm-navy">
            {sinLeer.length > 9 ? '9+' : sinLeer.length}
          </span>
        )}
      </button>
      <Dialog abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Notificaciones">
        {avisosSoportados() && pushOk && permiso === 'granted' && (
          <div className="flex items-center gap-2 rounded-xl bg-ok-bg px-3 py-2 text-[13px] font-semibold text-ok">
            <Icon n="check" size={16} /> Avisos activados en este teléfono, aunque la app esté cerrada.
          </div>
        )}
        {avisosSoportados() && (permiso !== 'granted' || !pushOk) && (
          <div className="flex flex-col gap-2 rounded-xl bg-info-bg p-3 text-[13px] text-info">
            {permiso === 'denied' ? (
              <span>
                Los avisos están bloqueados en este teléfono. Para activarlos: toca el ícono 🔒 junto a la
                dirección → Permisos → Notificaciones → Permitir.
              </span>
            ) : (
              <>
                <span>Recibe estos avisos como notificaciones del teléfono, aunque la app esté cerrada.</span>
                <Button
                  tamano="sm"
                  variante="pri"
                  className="self-start"
                  cargando={activando}
                  onClick={async () => {
                    setActivando(true);
                    try {
                      const r = await activarPush(perfil.uid);
                      if (r === 'ok') {
                        setPushOk(true);
                        toast('Avisos activados en este teléfono', 'ok');
                      } else if (r === 'no-disponible') {
                        // Sin el servicio push: al menos avisos con la app abierta o en segundo plano.
                        const p = await pedirPermisoAvisos();
                        if (p === 'granted') toast('Avisos activados mientras la app esté abierta', 'ok');
                      } else if (r === 'error') {
                        toast('No se pudo activar. Revisa tu conexión e inténtalo de nuevo.', 'error');
                      }
                    } finally {
                      setPermiso(permisoAvisos());
                      setActivando(false);
                    }
                  }}
                >
                  <Icon n="campana" size={16} />
                  Activar avisos en este teléfono
                </Button>
              </>
            )}
          </div>
        )}
        {datos.length === 0 ? (
          <Vacio titulo="Sin notificaciones" />
        ) : (
          <ul className="-mx-2 flex max-h-[60vh] flex-col overflow-y-auto">
            {datos.map((n) => {
              const leida = n.leidaPor?.includes(perfil.uid);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-track"
                    onClick={() => {
                      if (!leida) marcarLeida(n.id, perfil.uid).catch(() => {});
                      if (n.enlace) {
                        setAbierto(false);
                        nav(`${base}/${n.enlace}`);
                      }
                    }}
                  >
                    <span
                      className={cx(
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        leida ? 'bg-transparent' : 'bg-wm-blue',
                      )}
                      aria-hidden
                    />
                    <span className="flex-1">
                      <span className={cx('block', !leida && 'font-bold')}>{n.texto}</span>
                      <span className="text-xs text-muted">{haceTexto(n.creadoEn)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {sinLeer.length > 0 && (
          <button
            type="button"
            className="self-end text-[13px] font-bold text-wm-blue dark:text-info"
            onClick={() => sinLeer.forEach((n) => marcarLeida(n.id, perfil.uid).catch(() => {}))}
          >
            Marcar todas como leídas
          </button>
        )}
      </Dialog>
    </>
  );
}
