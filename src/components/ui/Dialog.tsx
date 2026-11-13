import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  titulo: ReactNode;
  children: ReactNode;
  ancho?: 'sm' | 'md' | 'lg';
  acciones?: ReactNode;
}

export function Dialog({ abierto, onCerrar, titulo, children, ancho = 'md', acciones }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const previo = useRef<Element | null>(null);
  // onCerrar cambia en cada render del padre (p. ej. al escribir): se guarda en una referencia para
  // que el efecto no se reinicie con cada letra (eso cerraba el teclado en Android).
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;

  useEffect(() => {
    if (!abierto) return;
    previo.current = document.activeElement;
    const el = ref.current;
    const focusables = () =>
      Array.from(
        el?.querySelectorAll<HTMLElement>(
          'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((x) => !x.hasAttribute('disabled'));
    // Enfoca el primer campo (o el marcado con data-autofocus).
    setTimeout(() => {
      const auto = el?.querySelector<HTMLElement>('[data-autofocus]');
      (auto ?? focusables()[0])?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrarRef.current();
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      (previo.current as HTMLElement | null)?.focus?.();
    };
  }, [abierto]);

  if (!abierto) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-[rgba(4,30,66,.55)] px-4 py-10 sm:py-[90px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dlg-titulo"
        className={cx(
          'flex w-full flex-col gap-3.5 rounded-[18px] bg-card p-[22px] shadow-[0_20px_50px_rgba(0,0,0,.3)]',
          ancho === 'sm' ? 'max-w-[400px]' : ancho === 'lg' ? 'max-w-[640px]' : 'max-w-[480px]',
        )}
      >
        <h2 id="dlg-titulo" className="text-lg">
          {titulo}
        </h2>
        {children}
        {acciones && <div className="flex flex-wrap justify-end gap-2">{acciones}</div>}
      </div>
    </div>,
    document.body,
  );
}
