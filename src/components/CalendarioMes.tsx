import type { Jornada } from '@/types';
import { calificarDia, type CalificacionDia, type Resoluciones } from '@/lib/jornada';
import { diaSemanaISO, fechaISO } from '@/lib/fechas';
import { Leyenda, cx } from './ui';

const ESTILO: Record<CalificacionDia | 'fut', string> = {
  ok: 'bg-ok-bg text-ok',
  obs: 'bg-warn-bg text-warn',
  late: 'bg-bad-bg text-bad',
  off: 'bg-track text-muted',
  fut: 'border border-dashed border-line text-muted',
};
const TEXTO: Record<CalificacionDia | 'fut', string> = {
  ok: 'a tiempo',
  obs: 'con observación',
  late: 'tardanza o sin salida',
  off: 'libre',
  fut: 'sin datos',
};

export function resumenMes(
  jornadas: Jornada[],
  anio: number,
  mes: number,
  res: Record<string, Resoluciones> = {},
) {
  const pref = `${anio}-${String(mes).padStart(2, '0')}`;
  const delMes = jornadas.filter((j) => j.fecha.startsWith(pref));
  const porDia = new Map<string, Jornada[]>();
  for (const j of delMes) porDia.set(j.fecha, [...(porDia.get(j.fecha) ?? []), j]);
  let tardanzas = 0;
  for (const js of porDia.values()) if (calificarDia(js, res) === 'late') tardanzas++;
  return { dias: porDia.size, tardanzas, porDia };
}

export function CalendarioMes({
  anio,
  mes,
  jornadas,
  resoluciones = {},
  onDia,
}: {
  anio: number;
  mes: number;
  jornadas: Jornada[];
  resoluciones?: Record<string, Resoluciones>;
  onDia?: (iso: string) => void;
}) {
  const hoy = fechaISO();
  const pref = `${anio}-${String(mes).padStart(2, '0')}`;
  const diasMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const offset = diaSemanaISO(`${pref}-01`);
  const { porDia } = resumenMes(jornadas, anio, mes, resoluciones);
  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(<div key={'v' + i} />);
  for (let d = 1; d <= diasMes; d++) {
    const iso = `${pref}-${String(d).padStart(2, '0')}`;
    const tipo: CalificacionDia | 'fut' =
      iso > hoy ? 'fut' : calificarDia(porDia.get(iso) ?? [], resoluciones);
    const Tag = onDia && porDia.has(iso) ? 'button' : 'div';
    celdas.push(
      <Tag
        key={iso}
        type={Tag === 'button' ? 'button' : undefined}
        onClick={Tag === 'button' ? () => onDia?.(iso) : undefined}
        className={cx(
          'flex aspect-square items-center justify-center rounded-lg text-xs font-semibold tabular',
          ESTILO[tipo],
          iso === hoy && 'ring-2 ring-wm-blue',
        )}
        aria-label={`${d}: ${TEXTO[tipo]}`}
      >
        {d}
      </Tag>,
    );
  }
  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1.5" aria-hidden>
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((x, i) => (
          <div key={i} className="text-center text-[11px] font-bold text-muted">
            {x}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">{celdas}</div>
      <div className="mt-2.5">
        <Leyenda
          items={[
            { color: 'rgb(var(--ok-bg))', texto: 'A tiempo' },
            { color: 'rgb(var(--warn-bg))', texto: 'Con observación' },
            { color: 'rgb(var(--bad-bg))', texto: 'Tardanza / sin salida' },
            { color: 'rgb(var(--track))', texto: 'Libre' },
          ]}
        />
      </div>
    </div>
  );
}
