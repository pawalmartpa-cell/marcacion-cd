import type { ReactNode } from 'react';
import { cx } from './cx';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        'inline-block h-6 w-6 animate-spin rounded-full border-[3px] border-wm-blue border-t-transparent',
        className,
      )}
      role="status"
      aria-label="Cargando"
    />
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-muted" aria-live="polite">
      <Spinner />
      <span>{texto}</span>
    </div>
  );
}

export function Vacio({
  titulo,
  children,
  icono,
}: {
  titulo: string;
  children?: ReactNode;
  icono?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      {icono && <div className="text-muted">{icono}</div>}
      <div className="font-bold">{titulo}</div>
      {children && <div className="max-w-sm text-[13px] text-muted">{children}</div>}
    </div>
  );
}

export function ErrorBox({ error, onReintentar }: { error: unknown; onReintentar?: () => void }) {
  const msg = mensajeError(error);
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border border-bad/30 bg-bad-bg p-3.5 text-bad"
      role="alert"
    >
      <span className="flex-1 font-semibold">{msg}</span>
      {onReintentar && (
        <button className="font-bold underline" onClick={onReintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}

export function mensajeError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'permission-denied': 'No tienes permiso para hacer esto.',
    unavailable: 'Sin conexión con el servidor. Se reintentará automáticamente.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'No existe una cuenta con ese correo.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Inicia sesión.',
    'auth/weak-password': 'La contraseña debe tener al menos 8 caracteres.',
    'auth/invalid-email': 'El correo no es válido.',
    'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.',
    'auth/cancelled-popup-request': 'Se canceló el inicio de sesión.',
    'auth/network-request-failed': 'Sin conexión a internet.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
    'failed-precondition': 'Falta un índice o una condición previa en la base de datos.',
  };
  if (map[code]) return map[code];
  if (e instanceof Error && e.message && !e.message.startsWith('Firebase')) return e.message;
  return 'Ocurrió un error inesperado. Intenta de nuevo.';
}

export function Tabs<T extends string>({
  valor,
  onChange,
  opciones,
  label,
}: {
  valor: T;
  onChange: (v: T) => void;
  opciones: Array<{ valor: T; texto: ReactNode }>;
  label: string;
}) {
  return (
    <div
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-track p-1"
      role="tablist"
      aria-label={label}
    >
      {opciones.map((o) => (
        <button
          key={o.valor}
          role="tab"
          aria-selected={valor === o.valor}
          className={cx(
            'h-9 whitespace-nowrap rounded-[9px] px-3.5 font-semibold',
            valor === o.valor
              ? 'bg-card text-wm-blue shadow-sm dark:text-info'
              : 'text-muted hover:text-text',
          )}
          onClick={() => onChange(o.valor)}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}

export function Pill({
  activo,
  children,
  onClick,
  className,
}: {
  activo?: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cx(
        'h-9 whitespace-nowrap rounded-full border px-3 font-semibold',
        activo ? 'border-wm-blue bg-wm-blue text-white' : 'border-line bg-card hover:bg-track',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Switch({
  activo,
  onChange,
  label,
  disabled,
}: {
  activo: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!activo)}
      className={cx(
        'relative h-[30px] w-[52px] shrink-0 rounded-full transition-colors disabled:opacity-50',
        activo ? 'bg-[#14834E]' : 'bg-[#8794AA]',
      )}
    >
      <span
        className={cx(
          'absolute top-[3px] h-6 w-6 rounded-full bg-white transition-[left]',
          activo ? 'left-[25px]' : 'left-[3px]',
        )}
      />
    </button>
  );
}

export function Avatar({
  nombre,
  apellidos,
  grande,
}: {
  nombre?: string;
  apellidos?: string;
  grande?: boolean;
}) {
  const ini = ((nombre?.[0] ?? '') + (apellidos?.[0] ?? '')).toUpperCase() || '?';
  return (
    <span
      className={cx(
        'flex shrink-0 items-center justify-center bg-wm-blue font-bold text-white',
        grande ? 'h-14 w-14 rounded-2xl text-xl' : 'h-9 w-9 rounded-full text-[13px]',
      )}
      aria-hidden
    >
      {ini}
    </span>
  );
}

export function Barra({ pct, color = 'bg-wm-blue', label }: { pct: number; color?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-track"
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={cx('h-2.5 rounded-full', color)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Leyenda({ items }: { items: Array<{ color: string; texto: string; redondo?: boolean }> }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted">
      {items.map((i) => (
        <span key={i.texto} className="inline-flex items-center gap-1.5">
          <b
            className={cx('inline-block h-3 w-3', i.redondo ? 'rounded' : 'rounded-[3px]')}
            style={{ background: i.color }}
          />
          {i.texto}
        </span>
      ))}
    </div>
  );
}

export function TablaWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('overflow-x-auto', className)}>
      <table className="tbl w-full border-collapse">{children}</table>
    </div>
  );
}
