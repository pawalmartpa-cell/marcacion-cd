import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, usePerfil } from '@/auth/AuthProvider';
import { ref } from '@/data/refs';
import { useAhora, useDocumento, useEnLinea } from '@/data/hooks';
import { useJornadaAbierta, useJornadasDeGuardia } from '@/data/consultas';
import { marcar, vincularDispositivo, type ResultadoMarca } from '@/data/servicios';
import { obtenerDeviceId } from '@/lib/device';
import { obtenerUbicacion, distanciaTexto, PRECISION_MAXIMA_M } from '@/lib/geo';
import {
  duracionTexto,
  fechaCorta,
  fechaISO,
  fechaLarga,
  hora,
  lunesDeISO,
  sumarDiasISO,
} from '@/lib/fechas';
import {
  ESTADO_MARCA,
  estadoJornada,
  estadoMarca,
  horaEfectiva,
  jornadaVigente,
  minutosTarde,
  minutosTrabajados,
} from '@/lib/jornada';
import { BannerConexion } from '@/components/BannerConexion';
import { EscanerQr } from '@/components/EscanerQr';
import { Icon } from '@/components/Icon';
import {
  Button,
  Card,
  CardHeader,
  Cargando,
  Chip,
  Dialog,
  ErrorBox,
  Vacio,
  cx,
  mensajeError,
  useToast,
} from '@/components/ui';
import type { Cd, Jornada, NombreTurno } from '@/types';
import { NOMBRES_TURNO } from '@/types';

const CLAVE_TURNO = 'marcacion.turno';

function turnoGuardado(): NombreTurno | null {
  try {
    const t = localStorage.getItem(CLAVE_TURNO);
    return NOMBRES_TURNO.includes(t as NombreTurno) ? (t as NombreTurno) : null;
  } catch {
    return null;
  }
}

export function Inicio() {
  const p = usePerfil();
  const { config } = useAuth();
  const toast = useToast();
  const enLinea = useEnLinea();
  const ahora = useAhora(1000);
  const hoy = fechaISO(ahora);
  const deviceId = useMemo(obtenerDeviceId, []);
  const cdDoc = useDocumento<Cd>(ref.cd(p.cdId));
  const abiertas = useJornadaAbierta(p.uid);
  const recientes = useJornadasDeGuardia(p.uid, sumarDiasISO(hoy, -8));
  const [turno, setTurno] = useState<NombreTurno | null>(turnoGuardado);
  const [paso, setPaso] = useState<'listo' | 'ubicando'>('listo');
  const [msgGps, setMsgGps] = useState('');
  const [resultado, setResultado] = useState<ResultadoMarca | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [qrAbierto, setQrAbierto] = useState(false);

  // Vincula el primer teléfono automáticamente; si es otro, deja la solicitud de cambio al admin.
  useEffect(() => {
    if (p.deviceId == null || (p.deviceId !== deviceId && p.deviceIdPendiente !== deviceId)) {
      vincularDispositivo(p, deviceId).catch(() => {});
    }
  }, [p, deviceId]);

  const cd = cdDoc.datos;
  const vigente = useMemo(
    () =>
      abiertas.datos
        .filter((j) => jornadaVigente(j, ahora))
        .sort((a, b) => horaEfectiva(b.entrada).getTime() - horaEfectiva(a.entrada).getTime())[0] ?? null,
    [abiertas.datos, ahora],
  );
  const sinSalida = abiertas.datos.filter((j) => !jornadaVigente(j, ahora));
  const pendientes = recientes.datos.filter((j) => j._pendiente).length;
  const otroTelefono = p.deviceId != null && p.deviceId !== deviceId;

  const avisarResultado = useCallback(
    (r: ResultadoMarca) => {
      setResultado(r);
      const parte = r.parte === 'entrada' ? 'Entrada' : 'Salida';
      toast(enLinea ? `${parte} registrada` : `${parte} guardada en el teléfono`, 'ok');
      r.sincronizada.catch((e) => {
        setResultado(null);
        const qr = r.marca.metodo === 'qr';
        toast(
          qr && (e as { code?: string }).code === 'permission-denied'
            ? 'El QR venció o no es válido. Escanéalo de nuevo o marca con GPS.'
            : `No se pudo guardar la marca: ${mensajeError(e)}`,
          'error',
        );
      });
    },
    [enLinea, toast],
  );

  const turnoActual = vigente ? vigente.turno : (cd?.turnos.find((t) => t.nombre === turno) ?? null);

  async function marcarGps() {
    if (!cd) return;
    if (!turnoActual) {
      toast('Elige tu turno antes de marcar', 'error');
      return;
    }
    setError(null);
    setResultado(null);
    setPaso('ubicando');
    setMsgGps('Obteniendo tu ubicación…');
    try {
      const lectura = await obtenerUbicacion({
        onReintento: (prec, i) =>
          setMsgGps(
            `Precisión de ${prec} m (debe ser menor a ${PRECISION_MAXIMA_M} m). Reintentando ${i}/3…`,
          ),
      });
      if (lectura.precision > PRECISION_MAXIMA_M) {
        toast(
          `Precisión baja (${lectura.precision} m). La marca se guardó igual y quedará en revisión si sale lejos.`,
          'error',
        );
      }
      const r = marcar({
        perfil: p,
        cd,
        turno: turnoActual,
        jornadaAbierta: vigente,
        deviceId,
        enLinea: navigator.onLine,
        diasRetencion: config.diasRetencion,
        lectura,
      });
      avisarResultado(r);
    } catch (e) {
      setError(e);
    } finally {
      setPaso('listo');
      setMsgGps('');
    }
  }

  const marcarQr = useCallback(
    (token: string) => {
      setQrAbierto(false);
      if (!cd || !turnoActual) return;
      const r = marcar({
        perfil: p,
        cd,
        turno: turnoActual,
        jornadaAbierta: vigente,
        deviceId,
        enLinea: true,
        diasRetencion: config.diasRetencion,
        qrToken: token,
      });
      avisarResultado(r);
    },
    [cd, turnoActual, p, vigente, deviceId, config.diasRetencion, avisarResultado],
  );

  if (cdDoc.cargando || abiertas.cargando) return <Cargando />;
  if (!cd)
    return (
      <Card>
        <Vacio titulo="Tu CD no está configurado">
          Pide a un administrador que revise tu centro de distribución.
        </Vacio>
      </Card>
    );

  const semana = recientes.datos.filter((j) => j.fecha >= lunesDeISO(hoy));
  const esSalida = !!vigente;

  return (
    <>
      <BannerConexion pendientes={pendientes} />

      <section className="rounded-2xl bg-wm-navy p-5 text-white" aria-label="Hora actual">
        <div className="text-[13px] text-[#A9B8D3]">{fechaLarga(ahora)}</div>
        <div className="tabular text-[44px] font-extrabold leading-tight" aria-live="off">
          {hora(ahora)}
          <span className="text-xl text-[#A9B8D3]">:{String(ahora.getSeconds()).padStart(2, '0')}</span>
        </div>
        <div className="text-[13px] text-[#C9D4E6]">
          {cd.nombre} {cd.codigo} · hora oficial de El Salvador
        </div>
      </section>

      {otroTelefono && (
        <div className="rounded-xl bg-warn-bg p-3 text-[13px] font-semibold text-warn" role="alert">
          Este no es tu teléfono registrado. Puedes marcar, pero la marca quedará con observación hasta que un
          administrador apruebe el cambio de teléfono (ya se le avisó).
        </div>
      )}

      {sinSalida.length > 0 && (
        <div className="rounded-xl bg-bad-bg p-3 text-[13px] text-bad" role="alert">
          <b>Tienes {sinSalida.length === 1 ? 'una jornada' : `${sinSalida.length} jornadas`} sin salida</b> (
          {sinSalida.map((j) => fechaCorta(j.fecha)).join(', ')}).{' '}
          <Link to="/app/solicitudes" className="font-bold !text-bad underline">
            Solicita una corrección
          </Link>
          .
        </div>
      )}

      <Card className="flex flex-col gap-4">
        {esSalida ? (
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-info-bg text-info">
              <Icon n="reloj" size={22} />
            </span>
            <div>
              <div className="text-lg font-extrabold">
                En turno desde {hora(horaEfectiva(vigente.entrada))}
              </div>
              <div className="text-[13px] text-muted">
                {vigente.turno.nombre}
                {vigente.turno.inicio ? ` · ${vigente.turno.inicio} – ${vigente.turno.fin}` : ''} · entrada
                del {fechaCorta(vigente.fecha)}
              </div>
            </div>
          </div>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-bold">¿Qué turno vas a cubrir?</legend>
            <div className="grid grid-cols-3 gap-2">
              {cd.turnos.map((t) => (
                <button
                  key={t.nombre}
                  type="button"
                  aria-pressed={turno === t.nombre}
                  onClick={() => {
                    setTurno(t.nombre);
                    try {
                      localStorage.setItem(CLAVE_TURNO, t.nombre);
                    } catch {
                      /* */
                    }
                  }}
                  className={cx(
                    'flex min-h-[64px] flex-col items-center justify-center rounded-xl border-2 px-1 font-bold',
                    turno === t.nombre ? 'border-wm-blue bg-info-bg text-info' : 'border-line bg-card',
                  )}
                >
                  {t.nombre}
                  <span className="tabular text-[11px] font-semibold text-muted">
                    {t.inicio && t.fin ? `${t.inicio} – ${t.fin}` : '[hh:mm – hh:mm]'}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <Button
          variante={esSalida ? 'yellow' : 'pri'}
          tamano="xl"
          className="w-full"
          onClick={marcarGps}
          cargando={paso === 'ubicando'}
          disabled={!esSalida && !turno}
        >
          <Icon n="ubicacion" size={26} />
          {esSalida ? 'Marcar salida' : 'Marcar entrada'}
        </Button>
        {msgGps && (
          <p className="-mt-2 text-center text-[13px] text-muted" aria-live="polite">
            {msgGps}
          </p>
        )}
        {cd.qrHabilitado && (
          <Button
            variante="out"
            tamano="lg"
            onClick={() =>
              turnoActual ? setQrAbierto(true) : toast('Elige tu turno antes de marcar', 'error')
            }
            disabled={!enLinea}
          >
            <Icon n="qr" /> Marcar con el QR de la garita
          </Button>
        )}
        {cd.qrHabilitado && !enLinea && (
          <p className="-mt-2 text-center text-xs text-muted">
            El QR necesita internet. Sin conexión marca con GPS.
          </p>
        )}
        {error != null && <ErrorBox error={error} onReintentar={marcarGps} />}
      </Card>

      {resultado && (
        <ResultadoCard
          r={resultado}
          cd={cd}
          turnoInicio={turnoActual?.inicio}
          tolerancia={cd.toleranciaMin}
          enLinea={enLinea}
        />
      )}

      <Card>
        <CardHeader
          titulo="Esta semana"
          accion={
            <Link to="/app/historial" className="text-[13px] font-bold">
              Ver historial
            </Link>
          }
        />
        {recientes.cargando ? (
          <Cargando />
        ) : semana.length === 0 ? (
          <Vacio titulo="Sin jornadas esta semana" />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {semana.map((j) => (
              <JornadaFila key={j.id} j={j} />
            ))}
          </ul>
        )}
      </Card>

      <Dialog
        abierto={qrAbierto}
        onCerrar={() => setQrAbierto(false)}
        titulo={esSalida ? 'Escanear QR · salida' : 'Escanear QR · entrada'}
      >
        {qrAbierto && <EscanerQr cdId={cd.id} onLeido={marcarQr} />}
        <Button onClick={() => setQrAbierto(false)}>Cancelar</Button>
      </Dialog>
    </>
  );
}

function ResultadoCard({
  r,
  cd,
  turnoInicio,
  tolerancia,
  enLinea,
}: {
  r: ResultadoMarca;
  cd: Cd;
  turnoInicio?: string;
  tolerancia: number;
  enLinea: boolean;
}) {
  const m = { ...r.marca, horaServidor: r.marca.horaDispositivo };
  const e = estadoMarca(m);
  const tarde =
    r.parte === 'entrada' && turnoInicio
      ? minutosTarde({
          entrada: m,
          turno: { nombre: 'Diurno', inicio: turnoInicio, fin: '' },
          toleranciaMin: tolerancia,
        })
      : 0;
  return (
    <Card className="flex flex-col gap-2 border-2 border-ok/40" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ok-bg text-ok">
          <Icon n="check" size={24} strokeWidth={3} />
        </span>
        <div>
          <div className="text-lg font-extrabold">
            {r.parte === 'entrada' ? 'Entrada' : 'Salida'} {enLinea ? 'registrada' : 'guardada'} ·{' '}
            {hora(r.marca.horaDispositivo)}
          </div>
          <div className="text-[13px] text-muted">
            {r.marca.metodo === 'qr' ? 'QR del kiosco' : `GPS · ${distanciaTexto(r.marca.distanciaM)} del CD`}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip tono={ESTADO_MARCA[e].tono}>{ESTADO_MARCA[e].texto}</Chip>
        {tarde > 0 && <Chip tono="bad">Llegada tarde · {tarde} min</Chip>}
        {r.marca.dispositivoDistinto && <Chip tono="warn">Otro teléfono</Chip>}
      </div>
      {r.marca.zona === 'alerta' && (
        <p className="text-[13px] text-bad">
          Marcaste a más de {distanciaTexto(cd.radioAlerta)} del CD. Se avisó a tu coordinador para que la
          revise.
        </p>
      )}
      {r.marca.zona === 'observacion' && (
        <p className="text-[13px] text-warn">La marca quedó con observación por la distancia.</p>
      )}
      {!enLinea && (
        <p className="text-[13px] text-info">
          Sin conexión: se enviará sola al volver el internet. No cierres sesión.
        </p>
      )}
    </Card>
  );
}

export function JornadaFila({ j, accion }: { j: Jornada; accion?: ReactNode }) {
  const est = estadoJornada(j);
  const tarde = minutosTarde(j);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
      <div className="w-[74px] shrink-0">
        <div className="font-bold tabular">{fechaCorta(j.fecha).slice(0, 5)}</div>
        <div className="text-xs text-muted">{j.turno.nombre}</div>
      </div>
      <div className="tabular flex flex-1 items-center gap-1.5 text-[15px] font-bold">
        <PuntoMarca j={j} parte="entrada" />
        {hora(horaEfectiva(j.entrada))}
        <span className="text-muted">→</span>
        {j.salida ? (
          <>
            <PuntoMarca j={j} parte="salida" />
            {hora(horaEfectiva(j.salida))}
          </>
        ) : (
          <span className="text-muted">—</span>
        )}
        <span className="ml-1 text-xs font-semibold text-muted">{duracionTexto(minutosTrabajados(j))}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip tono={est.tono}>{est.texto}</Chip>
        {tarde > 0 && <Chip tono="bad">Tarde {tarde} min</Chip>}
        {j.editada && <Chip tono="warn">editada</Chip>}
        {j._pendiente && <Chip tono="info">por enviar</Chip>}
        {accion}
      </div>
    </li>
  );
}

function PuntoMarca({ j, parte }: { j: Jornada; parte: 'entrada' | 'salida' }) {
  const m = j[parte];
  if (!m) return null;
  const e = ESTADO_MARCA[estadoMarca(m)];
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: e.color }}
      role="img"
      aria-label={e.texto}
    />
  );
}
