import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cx } from './cx';

export type Variante = 'default' | 'pri' | 'out' | 'ok' | 'danger' | 'ghost' | 'yellow';
export type Tamano = 'sm' | 'md' | 'lg' | 'xl';

const VAR: Record<Variante, string> = {
  default: 'border-line bg-card text-text hover:bg-track',
  pri: 'border-wm-blue bg-wm-blue text-white hover:bg-wm-blue-d hover:border-wm-blue-d',
  out: 'border-wm-blue bg-transparent text-wm-blue hover:bg-info-bg dark:border-info dark:text-info',
  ok: 'border-[#14834E] bg-[#14834E] text-white hover:bg-[#0F6B3F]',
  danger: 'border-[#C0392B] bg-transparent text-[#C0392B] hover:bg-bad-bg dark:border-bad dark:text-bad',
  ghost: 'border-transparent bg-transparent text-wm-blue hover:bg-info-bg dark:text-info',
  yellow: 'border-wm-yellow bg-wm-yellow text-wm-navy hover:brightness-95',
};
const TAM: Record<Tamano, string> = {
  sm: 'h-[34px] px-2.5 text-[13px]',
  md: 'h-[44px] px-3.5',
  lg: 'h-12 px-5 text-[15px]',
  xl: 'h-20 px-6 text-xl',
};

export function clasesBoton(v: Variante = 'default', t: Tamano = 'md', extra?: string) {
  return cx(
    'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-60',
    VAR[v],
    TAM[t],
    extra,
  );
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  cargando?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variante = 'default', tamano = 'md', cargando, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clasesBoton(variante, tamano, className)}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      {...rest}
    >
      {cargando && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
});

export function LinkButton({
  variante = 'default',
  tamano = 'md',
  className,
  ...rest
}: LinkProps & { variante?: Variante; tamano?: Tamano }) {
  return <Link className={clasesBoton(variante, tamano, className)} {...rest} />;
}
