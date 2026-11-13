import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { nombreCompleto } from '@/auth/AuthProvider';
import { useAlertas, useJornadasDeGuardia } from '@/data/consultas';
import { aprobarDispositivo, cambiarEstadoUsuario, habilitarCambioFirma } from '@/data/servicios';
import { fechaCorta, fechaISO, mesAnio, sumarDiasISO } from '@/lib/fechas';
import { resolucionesDe, type Resoluciones } from '@/lib/jornada';
import { CalendarioMes, resumenMes } from '@/components/CalendarioMes';
import { FirmaVista } from '@/components/FirmaVista';
import { Icon } from '@/components/Icon';
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Cargando,
  Chip,
  LinkButton,
  Vacio,
  mensajeError,
  useToast,
} from '@/components/ui';
import { ESTADO_USUARIO_TEXTO, ROL_TEXTO, type Jornada, type Parte } from '@/types';
import { useAuth } from '@/auth/AuthProvider';
import { usePanel } from './contexto';
import { Encabezado } from './Panel';
import { TablaJornadas } from './comp/TablaJornadas';
import { EditarJornada } from './comp/EditarJornada';
import { TONO_ROL, TONO_ESTADO } from './Usuarios';

export function GuardiaDetalle() {
  const { uid = '' } = useParams();
  const { usuario, esAdmin, actor, r, cdNombre, cargandoUsuarios } = usePanel();
  const { config } = useAuth();
  const toast = useToast();
  const g = usuario(uid);
  const hoy = fechaISO();
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)));
  const [mes, setMes] = useState(Number(hoy.slice(5, 7)));
  const jornadas = useJornadasDeGuardia(
    g ? uid : null,
    sumarDiasISO(hoy, -config.diasRetencion),
    undefined,
    esAdmin ? null : g?.cdId,
  );
  const alertas = useAlertas(g?.cdId ?? null, { max: 400 });
  const [editando, setEditando] = useState<{ j: Jornada; foco: Parte } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (cargandoUsuarios) return <Cargando />;
  if (!g)
    return (
      <>
        <Encabezado titulo="No encontrado" sinFiltro />
        <Card>
          <Vacio titulo="Ese usuario no existe o no pertenece a tu CD" />
        </Card>
      </>
    );

  const accion = async (f: () => Promise<unknown>, ok: string) => {
    setOcupado(true);
    try {
      await f();
      toast(ok, 'ok');
    } catch (e) {
      toast(mensajeError(e), 'error');
    } finally {
      setOcupado(false);
    }
  };

  const alertasG = alertas.datos.filter((a) => a.uid === uid);
  const res: Record<string, Resoluciones> = {};
  for (const j of jornadas.datos) res[j.id] = resolucionesDe(alertasG, j.id);
  const rm = resumenMes(jornadas.datos, anio, mes, res);
  const pref = `${anio}-${String(mes).padStart(2, '0')}`;
  const alertasMes = alertasG.filter((a) =>
    fechaISO(a.creadoEn?.toDate?.() ?? new Date()).startsWith(pref),
  ).length;
  const mover = (d: number) => {
    let m = mes + d;
    let a = anio;
    if (m < 1) [m, a] = [12, a - 1];
    if (m > 12) [m, a] = [1, a + 1];
    setMes(m);
    setAnio(a);
  };

  return (
    <>
      <Encabezado
        titulo={nombreCompleto(g)}
        sub={`${ROL_TEXTO[g.rol]} · ${cdNombre(g.cdId)} · registrado el ${fechaCorta(g.creadoEn)}`}
        crumb={
          <>
            <Link to={r('asistencia')} className="no-underline">
              Registros de asistencia
            </Link>{' '}
            / Detalle del guardia
          </>
        }
        acciones={
          <LinkButton to={r('asistencia')}>
            <Icon n="atras" size={16} />
            Volver
          </LinkButton>
        }
      />
      <div className="flex flex-wrap gap-4">
        <Card className="flex max-w-[420px] flex-[1_1_300px] flex-col gap-3.5">
          <div className="flex items-center gap-3.5">
            <Avatar nombre={g.nombre} apellidos={g.apellidos} grande />
            <div className="min-w-0">
              <div className="truncate text-lg font-extrabold">{nombreCompleto(g)}</div>
              <div className="truncate text-muted">{g.email}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip tono={TONO_ROL[g.rol]}>{ROL_TEXTO[g.rol]}</Chip>
            <Chip tono={TONO_ESTADO[g.estado]}>{ESTADO_USUARIO_TEXTO[g.estado]}</Chip>
            <Chip tono="info">Acceso: {g.proveedor === 'google' ? 'Google' : 'Correo'}</Chip>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-semibold text-muted">Firma</div>
            <FirmaVista firma={g.firma} alt={`Firma de ${nombreCompleto(g)}`} />
            {g.firma && (
              <div className="mt-1.5 text-xs text-muted">
                Firmada el {fechaCorta(g.firma.actualizadaEn)}
                {g.firma.cambioHabilitado ? ' · cambio habilitado' : ''}
              </div>
            )}
          </div>
          {g.deviceIdPendiente && (
            <div className="rounded-xl bg-warn-bg p-3 text-[13px] text-warn">
              <b>Pidió cambiar de teléfono.</b> Sus marcas desde el teléfono nuevo quedan con observación.
              {esAdmin && (
                <Button
                  tamano="sm"
                  variante="ok"
                  className="mt-2"
                  disabled={ocupado}
                  onClick={() =>
                    accion(
                      () => aprobarDispositivo(actor, g, g.deviceIdPendiente!),
                      'Cambio de teléfono aprobado',
                    )
                  }
                >
                  Aprobar teléfono nuevo
                </Button>
              )}
            </div>
          )}
          {esAdmin && (
            <div className="flex flex-wrap gap-2">
              <LinkButton tamano="sm" variante="out" to={r(`usuarios/${g.uid}/editar`)}>
                Editar datos
              </LinkButton>
              {g.estado === 'pendiente' ? (
                <Button
                  tamano="sm"
                  variante="ok"
                  disabled={ocupado}
                  onClick={() =>
                    accion(
                      () => cambiarEstadoUsuario(actor, g, 'activo'),
                      `${nombreCompleto(g)} aprobado: ya puede marcar`,
                    )
                  }
                >
                  Aprobar
                </Button>
              ) : (
                <Button
                  tamano="sm"
                  variante="danger"
                  disabled={ocupado || g.uid === actor.uid}
                  onClick={() =>
                    accion(
                      () => cambiarEstadoUsuario(actor, g, g.estado === 'bloqueado' ? 'activo' : 'bloqueado'),
                      g.estado === 'bloqueado'
                        ? `${nombreCompleto(g)} desbloqueado`
                        : `${nombreCompleto(g)} bloqueado: no puede entrar ni marcar`,
                    )
                  }
                >
                  {g.estado === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}
                </Button>
              )}
              {g.firma && !g.firma.cambioHabilitado && (
                <Button
                  tamano="sm"
                  disabled={ocupado}
                  onClick={() =>
                    accion(
                      () => habilitarCambioFirma(actor, g),
                      `Se notificó a ${nombreCompleto(g)} que puede cambiar su firma`,
                    )
                  }
                >
                  Habilitar cambio de firma
                </Button>
              )}
            </div>
          )}
        </Card>
        <Card className="flex-[1_1_320px]">
          <div className="flex items-center justify-between">
            <h2>{mesAnio(anio, mes)}</h2>
            <div className="flex gap-1">
              <Button tamano="sm" onClick={() => mover(-1)} aria-label="Mes anterior">
                <Icon n="atras" />
              </Button>
              <Button
                tamano="sm"
                onClick={() => mover(1)}
                disabled={pref >= hoy.slice(0, 7)}
                aria-label="Mes siguiente"
              >
                <Icon n="atras" className="rotate-180" />
              </Button>
            </div>
          </div>
          <div className="mb-3 mt-1 text-xs text-muted">Resumen visual del mes</div>
          {jornadas.cargando ? (
            <Cargando />
          ) : (
            <CalendarioMes anio={anio} mes={mes} jornadas={jornadas.datos} resoluciones={res} />
          )}
          <div className="mt-3.5 grid grid-cols-3 gap-2.5">
            {[
              ['Días trabajados', rm.dias],
              ['Tardanzas', rm.tardanzas],
              ['Alertas', alertasMes],
            ].map(([t, v]) => (
              <div key={t} className="rounded-xl bg-track p-3">
                <div className="text-xs text-muted">{t}</div>
                <div className="tabular text-[22px] font-extrabold">{v}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader titulo="Jornadas" sub={`Últimos ${config.diasRetencion} días`} />
        {jornadas.cargando ? (
          <Cargando />
        ) : (
          <TablaJornadas
            jornadas={jornadas.datos}
            alertas={alertasG}
            mostrarNombre={false}
            onEditar={esAdmin ? (j, foco) => setEditando({ j, foco }) : undefined}
            vacio="Sin jornadas en el periodo."
          />
        )}
      </Card>
      <EditarJornada
        jornada={editando?.j ?? null}
        foco={editando?.foco ?? 'entrada'}
        onCerrar={() => setEditando(null)}
      />
    </>
  );
}
