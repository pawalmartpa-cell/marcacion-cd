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

export function Kpi({
  etiqueta,
  valor,
  nota,
  destacado,
}: {
  etiqueta: string;
  valor: ReactNode;
  nota?: string;
  destacado?: boolean;
}) {
  return (
    <div className={cx('card h-full', destacado && 'border-transparent bg-warn-bg text-warn')}>
      <div className={cx('text-[13px]', destacado ? 'text-inherit' : 'text-muted')}>{etiqueta}</div>
      <div className="tabular mb-0.5 mt-1.5 text-[32px] font-extrabold leading-none">{valor}</div>
      {nota && <div className={cx('text-xs', destacado ? 'text-inherit' : 'text-muted')}>{nota}</div>}
    </div>
  );
}
