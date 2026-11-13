import { useMemo, useState } from 'react';
import { useAuth, nombreCompleto } from '@/auth/AuthProvider';
import { useReportes } from '@/data/consultas';
import { guardarReporte } from '@/data/servicios';
import { fechaCorta, fechaHora, fechaISO, sumarDiasISO } from '@/lib/fechas';
import {
  COLUMNAS_HOJA,
  TIPOS_REPORTE,
  construirTablas,
  generarReporte,
  tituloReporte,
  type Contexto,
  type ParametrosReporte,
  type TipoReporte,
} from '@/lib/reportes';
import { FirmaVista } from '@/components/FirmaVista';
import { Icon } from '@/components/Icon';
import {
  Button,
  Card,
  CardHeader,
  Cargando,
  Chip,
  ErrorBox,
  Field,
  TablaWrap,
  Vacio,
  mensajeError,
  useToast,
} from '@/components/ui';
import type { ReporteGenerado } from '@/types';
import { usePanel } from './contexto';
import { Encabezado } from './Panel';

export function Reportes() {
  const { cds, usuarios, usuario, cd, esAdmin, alcance, actor } = usePanel();
  const { config } = useAuth();
  const toast = useToast();
  const hoy = fechaISO();
  const [tipo, setTipo] = useState<TipoReporte>('cd');
  const [cdId, setCdId] = useState<string>(alcance ?? '');
  const [uid, setUid] = useState('');
  const [desde, setDesde] = useState(hoy.slice(0, 8) + '01');
  const [hasta, setHasta] = useState(hoy);
  const [firma, setFirma] = useState(true);
  const [generando, setGenerando] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    columnas: string[];
    filas: Array<Array<string | number>>;
    uids?: string[];
    colFirma?: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const historial = useReportes(esAdmin ? null : actor.cdId);
  const guardias = usuarios.filter((u) => u.rol === 'seguridad' && (!cdId || u.cdId === cdId));

  const ctx = useMemo<Contexto>(
    () => ({
      usuarios: new Map(usuarios.map((u) => [u.uid, u])),
      cds: new Map(cds.map((c) => [c.id, c])),
      nombreApp: config.nombreApp,
      generadoPor: actor.nombre,
    }),
    [usuarios, cds, config.nombreApp, actor.nombre],
  );

  const params = (formato: 'Excel' | 'PDF'): ParametrosReporte => ({
    tipo,
    formato,
    desde: desde <= hasta ? desde : hasta,
    hasta: hasta >= desde ? hasta : desde,
    cdId: esAdmin ? cdId || null : actor.cdId,
    uidGuardia: tipo === 'guardia' || uid ? uid || null : null,
    incluirFirma: firma,
  });

  const validar = () => {
    if (tipo === 'guardia' && !uid) {
      toast('Elige el guardia', 'error');
      return false;
    }
    return true;
  };

  async function generar(formato: 'Excel' | 'PDF', p = params(formato), registrar = true) {
    if (registrar && !validar()) return;
    setGenerando(formato + (registrar ? '' : p.desde));
    setError(null);
    try {
      const n = await generarReporte(p, ctx);
      if (registrar) {
        await guardarReporte(actor, { ...p, nombre: tituloReporte(p, ctx), filas: n });
      }
      toast(`Reporte ${formato} generado (${n} filas)`, 'ok');
    } catch (e) {
      setError(e);
      toast(mensajeError(e), 'error');
    } finally {
      setGenerando(null);
    }
  }

  async function verPrevia() {
    if (!validar()) return;
    setGenerando('previa');
    setError(null);
    try {
      const [t] = await construirTablas(params('Excel'), ctx);
      setPreview({
        columnas: t!.columnas,
        filas: t!.filas.slice(0, 8),
        uids: t!.uidsFila,
        colFirma: t!.colFirma,
        total: t!.filas.length,
      });
    } catch (e) {
      setError(e);
    } finally {
      setGenerando(null);
    }
  }

  return (
    <>
      <Encabezado titulo="Reportes" sub="Excel o PDF por guardia, CD y rango de fechas" sinFiltro />
      <div className="flex flex-wrap gap-4">
        <Card className="flex flex-[1_1_340px] flex-col gap-3.5">
          <h2>Generar reporte</h2>
          <Field label="Tipo">
            <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as TipoReporte)}>
              {Object.entries(TIPOS_REPORTE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="CD">
              <select
                className="input"
                value={esAdmin ? cdId : actor.cdId}
                disabled={!esAdmin}
                onChange={(e) => {
                  setCdId(e.target.value);
                  setUid('');
                }}
              >
                {esAdmin && <option value="">Todos</option>}
                {cds.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.codigo}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Guardia">
              <select
                className="input"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                disabled={tipo === 'bitacora'}
              >
                <option value="">{tipo === 'guardia' ? 'Elige…' : 'Todos'}</option>
                {guardias.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {nombreCompleto(u)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Desde">
              <input
                type="date"
                className="input"
                value={desde}
                max={hoy}
                min={sumarDiasISO(hoy, -config.diasRetencion)}
                onChange={(e) => setDesde(e.target.value)}
              />
            </Field>
            <Field label="Hasta">
              <input
                type="date"
                className="input"
                value={hasta}
                max={hoy}
                onChange={(e) => setHasta(e.target.value)}
              />
            </Field>
          </div>
          {(tipo === 'guardia' || tipo === 'cd') && (
            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={firma}
                onChange={(e) => setFirma(e.target.checked)}
                className="h-[18px] w-[18px] accent-wm-blue"
              />
              Incluir firma de cada guardia
            </label>
          )}
          {error != null && <ErrorBox error={error} />}
          <div className="flex gap-2">
            <Button
              variante="pri"
              className="flex-1"
              cargando={generando === 'Excel'}
              disabled={!!generando}
              onClick={() => generar('Excel')}
            >
              <Icon n="descargar" size={16} /> Excel
            </Button>
            <Button
              variante="out"
              className="flex-1"
              cargando={generando === 'PDF'}
              disabled={!!generando}
              onClick={() => generar('PDF')}
            >
              <Icon n="descargar" size={16} /> PDF
            </Button>
          </div>
        </Card>
        <Card className="flex flex-[1_1_340px] flex-col gap-2.5">
          <CardHeader
            titulo="Vista previa"
            accion={
              <Button
                tamano="sm"
                onClick={verPrevia}
                cargando={generando === 'previa'}
                disabled={!!generando}
              >
                Cargar vista previa
              </Button>
            }
          />
          {preview ? (
            <>
              <div className="overflow-x-auto rounded-[10px] border border-line">
                <table className="tbl w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-wm-blue">
                      {preview.columnas.map((c) => (
                        <th key={c} className="!text-white">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.filas.length === 0 && (
                      <tr>
                        <td colSpan={preview.columnas.length} className="text-muted">
                          Sin datos en el rango elegido.
                        </td>
                      </tr>
                    )}
                    {preview.filas.map((f, i) => (
                      <tr key={i}>
                        {f.map((v, k) => (
                          <td key={k}>
                            {k === preview.colFirma ? (
                              <FirmaVista
                                firma={usuario(preview.uids?.[i] ?? '')?.firma}
                                className="!h-9 !w-32 [&_span]:!text-lg"
                              />
                            ) : (
                              v
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <span className="text-xs text-muted">
                Mostrando {preview.filas.length} de {preview.total} filas.
              </span>
            </>
          ) : (
            <p className="text-[13px] text-muted">
              Columnas de asistencia: {COLUMNAS_HOJA.join(', ')}. Mismo orden que la hoja de papel.
            </p>
          )}
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader
          titulo="Reportes generados"
          sub="El archivo se vuelve a generar con los datos actuales al descargarlo"
        />
        {historial.cargando ? (
          <Cargando />
        ) : historial.error ? (
          <ErrorBox error={historial.error} />
        ) : historial.datos.length === 0 ? (
          <Vacio titulo="Aún no se han generado reportes" />
        ) : (
          <TablaWrap>
            <thead>
              <tr>
                <th>Reporte</th>
                <th>Rango</th>
                <th>Formato</th>
                <th>Generado por</th>
                <th>Fecha</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {historial.datos.map((h: ReporteGenerado) => (
                <tr key={h.id}>
                  <td className="font-bold">{h.nombre}</td>
                  <td className="tabular">
                    {fechaCorta(h.desde)} – {fechaCorta(h.hasta)}
                  </td>
                  <td>
                    <Chip tono={h.formato === 'Excel' ? 'ok' : 'bad'}>{h.formato}</Chip>
                  </td>
                  <td>{h.porNombre}</td>
                  <td className="tabular">{fechaHora(h.fecha)}</td>
                  <td>
                    <Button
                      tamano="sm"
                      variante="out"
                      disabled={!!generando || (h.cdId != null && !cd(h.cdId))}
                      cargando={generando === h.formato + h.desde}
                      onClick={() =>
                        generar(
                          h.formato,
                          {
                            tipo: h.tipo as TipoReporte,
                            formato: h.formato,
                            desde: h.desde,
                            hasta: h.hasta,
                            cdId: h.cdId,
                            uidGuardia: h.uidGuardia,
                            incluirFirma: h.incluirFirma,
                          },
                          false,
                        )
                      }
                    >
                      <Icon n="descargar" size={16} />
                      Descargar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </TablaWrap>
        )}
      </Card>
    </>
  );
}
