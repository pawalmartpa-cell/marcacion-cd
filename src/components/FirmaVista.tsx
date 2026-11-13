import type { Firma } from '@/types';
import { svgADataUri, textoDeFirma } from '@/lib/firma';
import { cx } from './ui';

/** Muestra una firma de forma segura (sin insertar SVG del usuario en la página). */
export function FirmaVista({
  firma,
  className,
  alt = 'Firma',
}: {
  firma: Firma | null | undefined;
  className?: string;
  alt?: string;
}) {
  if (!firma) return <span className="text-muted">Aún no registra firma</span>;
  return (
    <div className={cx('sig-box', className)}>
      {firma.tipo === 'generada' && firma.fuente ? (
        <span
          className="truncate px-3 text-[34px] leading-none text-wm-navy"
          style={{ fontFamily: `"${firma.fuente}", cursive` }}
          role="img"
          aria-label={alt}
        >
          {textoDeFirma(firma.svg)}
        </span>
      ) : (
        <img src={svgADataUri(firma.svg)} alt={alt} className="h-full w-full object-contain p-1" />
      )}
    </div>
  );
}
