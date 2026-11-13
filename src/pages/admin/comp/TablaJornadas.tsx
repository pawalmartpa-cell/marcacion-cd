import { Link } from 'react-router-dom';
import type { Alerta, Jornada, Parte } from '@/types';
import type { ConId } from '@/data/hooks';
import {
  ESTADO_MARCA,
  detalleMarca,
  estadoJornada,
  estadoMarca,
  horaEfectiva,
  minutosTarde,
  minutosTrabajados,
  resolucionesDe,
} from '@/lib/jornada';
import { duracionTexto, fechaCorta, fechaISO, hora, sumarDiasISO } from '@/lib/fechas';
import { Avatar, Button, Chip, cx } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { usePanel } from '../contexto';

export function etiquetaDia(iso: string): string {
  const hoy = fechaISO();
  if (iso === hoy) return 'Hoy · ';
  if (iso === sumarDiasISO(hoy, -1)) return 'Ayer · ';
  return '';
}

function CajaMarca({
  j,
  parte,
  alertas,
  onEditar,
}: {
  j: Jornada;
  parte: Parte;
  alertas: Alerta[];
  onEditar?: (j: Jornada, p: Parte) => void;
}) {
  const m = j[parte];
  const nombreParte = parte === 'entrada' ? 'Entrada' : 'Salida';
  const base =
    'flex min-h-[72px] min-w-0 flex-1 basis-0 flex-col justify-center gap-0.5 rounded-xl border px-3 py-2 text-left';
  if (!m) {
    return onEditar ? (
      <button
        type="button"
        className={cx(
          base,
          'items-center border-dashed border-line font-bold text-wm-blue hover:border-wm-blue hover:bg-info-bg dark:text-info',
        )}
        onClick={() => onEditar(j, parte)}
        aria-label={`Agregar ${nombreParte.toLowerCase()} de ${j.nombre}`}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{nombreParte}</span>+
        Agregar
      </button>
    ) : (
      <div className={cx(base, 'border-dashed border-line')}>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{nombreParte}</span>
        <span className="text-muted">Sin marcar</span>
      </div>
    );
  }
  const res = resolucionesDe(alertas, j.id)[parte];
  const e = ESTADO_MARCA[estadoMarca(m, res)];
  const contenido = (
    <>
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
        <i className="inline-block h-2 w-2 rounded-full" style={{ background: e.color }} aria-hidden />
        {nombreParte}
      </span>
      <b className="tabular text-xl leading-tight">{hora(horaEfectiva(m))}</b>
      <span className="truncate text-[11px] text-muted">{detalleMarca(m)}</span>
    </>
  );
  const titulo = `${detalleMarca(m)} · ${e.texto}`;
  return onEditar ? (
    <button
      type="button"
      className={cx(base, 'border-line hover:border-wm-blue hover:bg-info-bg')}
      title={titulo}
      aria-label={`${nombreParte} ${hora(horaEfectiva(m))}, ${titulo}. Corregir`}
      onClick={() => onEditar(j, parte)}
    >
      {contenido}
    </button>
  ) : (
    <div className={cx(base, 'border-line')} title={titulo}>
      {contenido}
    </div>
  );
}

export function TablaJornadas({
  jornadas,
  alertas,
  mostrarNombre = true,
  onEditar,
  vacio = 'No hay jornadas con ese filtro.',
}: {
  jornadas: Array<ConId<Jornada>>;
  alertas: Alerta[];
  mostrarNombre?: boolean;
  onEditar?: (j: Jornada, parte: Parte) => void;
  vacio?: string;
}) {
  const { r, cdNombre } = usePanel();
  const dias = [...new Set(jornadas.map((j) => j.fecha))].sort().reverse();
  if (jornadas.length === 0) return <p className="py-6 text-center text-muted">{vacio}</p>;
  return (
    <div className="flex flex-col gap-4">
      {dias.map((d) => {
        const delDia = jornadas.filter((j) => j.fecha === d);
        return (
          <section key={d} aria-label={`Jornadas del ${fechaCorta(d)}`}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
              {etiquetaDia(d)}
              {fechaCorta(d)} · {delDia.length} jornada{delDia.length === 1 ? '' : 's'}
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {delDia.map((j) => {
                const est = estadoJornada(j, resolucionesDe(alertas, j.id));
                const tarde = minutosTarde(j);
                const min = minutosTrabajados(j);
                return (
                  <article key={j.id} className="card flex min-w-0 flex-col gap-3 !p-4">
                    <div className="flex items-start gap-3">
                      {mostrarNombre && (
                        <Avatar nombre={j.nombre.split(' ')[0]} apellidos={j.nombre.split(' ')[1]} />
                      )}
                      <div className="min-w-0 flex-1">
                        {mostrarNombre && (
                          <>
                            <Link
                              to={r(`guardia/${j.uid}`)}
                              className="block truncate font-bold no-underline"
                            >
                              {j.nombre}
                            </Link>
                            <div className="truncate text-[13px] text-muted">{cdNombre(j.cdId)}</div>
                          </>
                        )}
                        <div
                          className={cx(
                            'tabular truncate text-[13px]',
                            mostrarNombre ? 'text-muted' : 'font-semibold',
                          )}
                        >
                          {j.turno.nombre}
                          {j.turno.inicio ? ` · ${j.turno.inicio}–${j.turno.fin}` : ''}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[11px] text-muted">Horas</div>
                        <div className="tabular text-sm font-bold">
                          {min != null ? duracionTexto(min) : '—'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <CajaMarca j={j} parte="entrada" alertas={alertas} onEditar={onEditar} />
                      <CajaMarca j={j} parte="salida" alertas={alertas} onEditar={onEditar} />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                      <Chip tono={est.tono}>{est.texto}</Chip>
                      {tarde > 0 && <Chip tono="bad">Tarde {tarde} min</Chip>}
                      {j.editada && <Chip tono="warn">editada</Chip>}
                      {onEditar && (
                        <Button
                          tamano="sm"
                          variante="ghost"
                          className="ml-auto !px-2"
                          onClick={() => onEditar(j, 'entrada')}
                        >
                          <Icon n="editar" size={14} />
                          Editar jornada
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
