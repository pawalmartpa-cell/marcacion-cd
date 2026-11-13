import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useNotificaciones } from '@/data/consultas';
import { marcarLeida } from '@/data/servicios';
import { haceTexto } from '@/lib/fechas';
import { Icon } from './Icon';
import { Dialog, Vacio, cx } from './ui';

export function CampanaNotificaciones({ base, oscuro }: { base: string; oscuro?: boolean }) {
  const { perfil } = useAuth();
  const { datos } = useNotificaciones();
  const [abierto, setAbierto] = useState(false);
  const nav = useNavigate();
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
