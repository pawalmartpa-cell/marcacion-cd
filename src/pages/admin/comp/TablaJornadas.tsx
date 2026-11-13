import { Fragment } from 'react';
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
import { Button, Chip, cx } from '@/components/ui';
import { usePanel } from '../contexto';

export function etiquetaDia(iso: string): string {
  const hoy = fechaISO();
  if (iso === hoy) return 'Hoy · ';
  if (iso === sumarDiasISO(hoy, -1)) return 'Ayer · ';
  return '';
}

function CeldaHora({
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
  const nombreParte = parte === 'entrada' ? 'entrada' : 'salida';
  if (!m) {
    return onEditar ? (
      <button
        type="button"
        className="flex min-h-[44px] min-w-[118px] items-center justify-center rounded-[10px] border border-dashed border-line px-2.5 font-bold text-wm-blue hover:border-wm-blue hover:bg-info-bg dark:text-info"
        onClick={() => onEditar(j, parte)}
        aria-label={`Agregar ${nombreParte} de ${j.nombre}`}
      >
        + Agregar
      </button>
    ) : (
      <span className="text-muted">—</span>
    );
  }
  const res = resolucionesDe(alertas, j.id)[parte];
  const e = ESTADO_MARCA[estadoMarca(m, res)];
  const titulo = `${detalleMarca(m)} · ${e.texto}`;
  const contenido = (
    <>
      <i
        className="absolute left-2.5 top-[13px] h-2 w-2 rounded-full"
        style={{ background: e.color }}
        aria-hidden
      />
      <b className="tabular pl-3.5 text-base">{hora(horaEfectiva(m))}</b>
      <span className="pl-3.5 text-[11px] text-muted">{detalleMarca(m)}</span>
    </>
  );
  const clase =
    'relative flex min-w-[118px] flex-col items-start gap-px rounded-[10px] border border-dashed border-transparent px-2.5 py-1.5 text-left';
  return onEditar ? (
    <button
      type="button"
      className={cx(clase, 'hover:border-wm-blue hover:bg-info-bg')}
      title={titulo}
      aria-label={`${nombreParte} ${hora(horaEfectiva(m))}, ${titulo}. Corregir`}
      onClick={() => onEditar(j, parte)}
    >
      {contenido}
    </button>
  ) : (
    <div className={clase} title={titulo}>
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
  const cols = mostrarNombre ? 7 : 6;
  return (
    <div className="overflow-x-auto">
      <table className="tbl w-full border-collapse">
        <thead>
          <tr>
            {mostrarNombre && <th scope="col">Guardia</th>}
            <th scope="col">Turno</th>
            <th scope="col">Entrada</th>
            <th scope="col">Salida</th>
            <th scope="col">Horas</th>
            <th scope="col">Estado</th>
            <th scope="col">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {jornadas.length === 0 && (
            <tr>
              <td colSpan={cols} className="text-muted">
                {vacio}
              </td>
            </tr>
          )}
          {dias.map((d) => {
            const delDia = jornadas.filter((j) => j.fecha === d);
            return (
              <Fragment key={d}>
                <tr className="daysep">
                  <td colSpan={cols}>
                    {etiquetaDia(d)}
                    {fechaCorta(d)} · {delDia.length} jornada{delDia.length === 1 ? '' : 's'}
                  </td>
                </tr>
                {delDia.map((j) => {
                  const est = estadoJornada(j, resolucionesDe(alertas, j.id));
                  const tarde = minutosTarde(j);
                  return (
                    <tr key={j.id}>
                      {mostrarNombre && (
                        <td>
                          <Link to={r(`guardia/${j.uid}`)} className="font-bold no-underline">
                            {j.nombre}
                          </Link>
                          <div className="text-xs text-muted">{cdNombre(j.cdId)}</div>
                        </td>
                      )}
                      <td>
                        {j.turno.nombre}
                        {j.turno.inicio && (
                          <div className="tabular text-xs text-muted">
                            {j.turno.inicio} – {j.turno.fin}
                          </div>
                        )}
                      </td>
                      <td>
                        <CeldaHora j={j} parte="entrada" alertas={alertas} onEditar={onEditar} />
                      </td>
                      <td>
                        <CeldaHora j={j} parte="salida" alertas={alertas} onEditar={onEditar} />
                      </td>
                      <td className="tabular">
                        {minutosTrabajados(j) != null ? (
                          duracionTexto(minutosTrabajados(j))
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <Chip tono={est.tono}>{est.texto}</Chip>
                          {tarde > 0 && <Chip tono="bad">Tarde {tarde} min</Chip>}
                          {j.editada && (
                            <Chip tono="warn" className="!text-[11px]">
                              editada
                            </Chip>
                          )}
                        </div>
                      </td>
                      <td>
                        {onEditar && (
                          <Button tamano="sm" variante="out" onClick={() => onEditar(j, 'entrada')}>
                            Editar jornada
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
