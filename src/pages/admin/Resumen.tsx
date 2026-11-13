import { Link, useNavigate } from 'react-router-dom';
import { useAhora } from '@/data/hooks';
import { useJornadas } from '@/data/consultas';
import { fechaISO, fechaLarga, hora, sumarDiasISO } from '@/lib/fechas';
import { estadoJornada, horaEfectiva, jornadaVigente, resolucionesDe } from '@/lib/jornada';
import { Barra, Card, CardHeader, Cargando, Chip, ErrorBox, Kpi, TablaWrap, Vacio } from '@/components/ui';
import { usePanel } from './contexto';
import { Icon } from '@/components/Icon';
import { Encabezado } from './Panel';
import { ChipSeveridad } from './comp/ChipsAlerta';

export function Resumen() {
  const { alcance, cds, usuarios, alertasAbiertas, r, cdNombre } = usePanel();
  const ahora = useAhora(60000);
  const hoy = fechaISO(ahora);
  const jornadas = useJornadas(alcance, sumarDiasISO(hoy, -1), hoy);
  const nav = useNavigate();

  const enTurno = jornadas.datos.filter((j) => jornadaVigente(j, ahora));
  let marcasHoy = 0;
  for (const j of jornadas.datos) {
    if (fechaISO(horaEfectiva(j.entrada)) === hoy) marcasHoy++;
    if (j.salida && fechaISO(horaEfectiva(j.salida)) === hoy) marcasHoy++;
  }
  const pendientes = usuarios.filter((u) => u.estado === 'pendiente').length;
  const deHoy = jornadas.datos.filter((j) => j.fecha === hoy || jornadaVigente(j, ahora));
  const cdsVisibles = cds.filter((c) => !alcance || c.id === alcance);

  return (
    <>
      <Encabezado titulo="Resumen general" sub={fechaLarga(ahora)} />
      {jornadas.error && <ErrorBox error={jornadas.error} />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link to={r('asistencia')} className="!text-inherit no-underline">
          <Kpi
            etiqueta="En turno ahora"
            valor={enTurno.length}
            nota="entradas sin salida"
            icono={<Icon n="reloj" />}
            tono="info"
          />
        </Link>
        <Link to={r('asistencia')} className="!text-inherit no-underline">
          <Kpi
            etiqueta="Marcaciones hoy"
            valor={marcasHoy}
            nota="GPS y QR"
            icono={<Icon n="ubicacion" />}
            tono="ok"
          />
        </Link>
        <Link to={r('usuarios')} className="!text-inherit no-underline">
          <Kpi
            etiqueta="Por aprobar"
            valor={pendientes}
            nota="cuentas nuevas"
            icono={<Icon n="users" />}
            tono="warn"
          />
        </Link>
        <Link to={r('alertas')} className="!text-inherit no-underline">
          <Kpi
            etiqueta="Alertas abiertas"
            valor={alertasAbiertas.length}
            nota={alertasAbiertas.length ? 'revisar hoy' : 'todo en orden'}
            icono={<Icon n="alerta" />}
            tono="bad"
            destacado={alertasAbiertas.length > 0}
          />
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        <Card className="flex-[1_1_340px]">
          <CardHeader titulo="Guardias en turno por CD" />
          {cdsVisibles.length === 0 ? (
            <Vacio titulo="Aún no hay CD">Agrégalos en “Centros de distribución”.</Vacio>
          ) : (
            <div className="flex flex-col gap-3.5">
              {cdsVisibles.map((c) => {
                const total = usuarios.filter(
                  (u) => u.cdId === c.id && u.rol === 'seguridad' && u.estado === 'activo',
                ).length;
                const en = new Set(enTurno.filter((j) => j.cdId === c.id).map((j) => j.uid)).size;
                return (
                  <div key={c.id} className="flex flex-col gap-1.5">
                    <div className="flex justify-between">
                      <b>
                        {c.nombre} {c.codigo}
                      </b>
                      <span className="text-muted tabular">
                        {en} de {total}
                      </span>
                    </div>
                    <Barra pct={total ? (en / total) * 100 : 0} label={`Ocupación de ${c.nombre}`} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <Card className="flex-[1_1_340px]">
          <CardHeader
            titulo="Alertas abiertas"
            accion={
              <Link to={r('alertas')} className="text-[13px] font-bold">
                Ver todas
              </Link>
            }
          />
          <div className="flex flex-col gap-2">
            {alertasAbiertas.length === 0 ? (
              <span className="text-muted">Sin alertas abiertas.</span>
            ) : (
              alertasAbiertas.slice(0, 5).map((a) => (
                <Link
                  key={a.id}
                  to={r(`alertas/${a.id}`)}
                  className="flex items-center gap-3 rounded-xl border border-line p-2.5 !text-inherit no-underline hover:bg-track"
                >
                  <ChipSeveridad s={a.severidad} />
                  <span className="flex-1">
                    <b>{a.nombre}</b> · {cdNombre(a.cdId)}
                    <br />
                    <span className="text-xs text-muted">{a.texto}</span>
                  </span>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader
          titulo="Jornadas de hoy"
          accion={
            <Link to={r('asistencia')} className="text-[13px] font-bold">
              Ver registros
            </Link>
          }
        />
        {jornadas.cargando ? (
          <Cargando />
        ) : deHoy.length === 0 ? (
          <Vacio titulo="Aún no hay marcaciones hoy" />
        ) : (
          <TablaWrap>
            <thead>
              <tr>
                <th>Guardia</th>
                <th>CD</th>
                <th>Turno</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {deHoy.slice(0, 12).map((j) => {
                const e = estadoJornada(j, resolucionesDe(alertasAbiertas, j.id), ahora);
                return (
                  <tr key={j.id} className="click" onClick={() => nav(r(`guardia/${j.uid}`))}>
                    <td>
                      <b>{j.nombre}</b>
                    </td>
                    <td>{cdNombre(j.cdId)}</td>
                    <td>{j.turno.nombre}</td>
                    <td className="tabular font-bold">{hora(horaEfectiva(j.entrada))}</td>
                    <td className="tabular font-bold">{j.salida ? hora(horaEfectiva(j.salida)) : '—'}</td>
                    <td>
                      <Chip tono={e.tono}>{e.texto}</Chip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TablaWrap>
        )}
      </Card>
    </>
  );
}
