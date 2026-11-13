import { useEnLinea } from '@/data/hooks';
import { Icon } from './Icon';

export function BannerConexion({ pendientes = 0 }: { pendientes?: number }) {
  const enLinea = useEnLinea();
  if (enLinea && pendientes === 0) return null;
  return (
    <div
      className={
        'flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold ' +
        (enLinea ? 'bg-info-bg text-info' : 'bg-warn-bg text-warn')
      }
      role="status"
      aria-live="polite"
    >
      <Icon n={enLinea ? 'nube' : 'nubeOff'} />
      <span className="flex-1">
        {enLinea ? 'Enviando marcas guardadas…' : 'Sin conexión · se enviará al reconectar'}
      </span>
      {pendientes > 0 && (
        <span
          className="rounded-full bg-wm-navy px-2 py-0.5 text-xs font-extrabold text-wm-yellow"
          aria-label={`${pendientes} marcas pendientes`}
        >
          {pendientes} pendiente{pendientes === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}
