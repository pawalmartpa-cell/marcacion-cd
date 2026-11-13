import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cx('card', className)} {...rest} />;
}

export function CardHeader({
  titulo,
  accion,
  sub,
}: {
  titulo: ReactNode;
  accion?: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2>{titulo}</h2>
        {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
      </div>
      {accion}
    </div>
  );
}

const TONO_KPI = {
  info: 'bg-info-bg text-info',
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  bad: 'bg-bad-bg text-bad',
} as const;

/** Tarjeta de indicador compacta: ícono de color, cifra y nota. */
export function Kpi({
  etiqueta,
  valor,
  nota,
  icono,
  tono = 'info',
  destacado,
}: {
  etiqueta: string;
  valor: ReactNode;
  nota?: string;
  icono?: ReactNode;
  tono?: keyof typeof TONO_KPI;
  /** Resalta la tarjeta (p. ej. hay alertas abiertas). */
  destacado?: boolean;
}) {
  return (
    <div
      className={cx(
        'relative flex h-full flex-col gap-2 overflow-hidden rounded-2xl border border-line bg-card p-3.5 transition-colors hover:border-wm-blue/50 sm:p-4',
        destacado && 'border-transparent ring-1 ring-inset ring-bad/40',
      )}
    >
      {destacado && <span className="absolute inset-y-0 left-0 w-1 bg-[#D93A26]" aria-hidden />}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold leading-tight text-muted sm:text-[13px]">{etiqueta}</span>
        {icono && (
          <span
            className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', TONO_KPI[tono])}
            aria-hidden
          >
            {icono}
          </span>
        )}
      </div>
      <div className="tabular text-[26px] font-extrabold leading-none sm:text-[28px]">{valor}</div>
      {nota && <div className="text-[11px] text-muted sm:text-xs">{nota}</div>}
    </div>
  );
}
