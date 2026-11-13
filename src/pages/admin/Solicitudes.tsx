import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getDoc } from 'firebase/firestore';
import { useAuth } from '@/auth/AuthProvider';
import { ref } from '@/data/refs';
import { useSolicitudes } from '@/data/consultas';
import { crearJornadaAdmin, resolverSolicitud } from '@/data/servicios';
import { fechaCorta, fechaHora, fechaISO } from '@/lib/fechas';
import {
  Button,
  Card,
  Cargando,
  Chip,
  Dialog,
  ErrorBox,
  Field,
  Pill,
  Tabs,
  Vacio,
  mensajeError,
  useToast,
} from '@/components/ui';
import type { Jornada, NombreTurno, Solicitud } from '@/types';
import { ESTADO_SOLICITUD, TIPO_SOLICITUD } from '@/pages/guardia/SolicitudesGuardia';
import { usePanel } from './contexto';
import { HoraInput } from '@/components/HoraInput';
import { Encabezado } from './Panel';
import { EditarJornada, MOTIVOS_RAPIDOS, horasAFechas } from './comp/EditarJornada';

export function Solicitudes() {
  const { alcance, esAdmin, actor, r, cdNombre } = usePanel();
  const toast = useToast();
  const [tab, setTab] = useState<'abierta' | 'cerradas'>('abierta');
  const sols = useSolicitudes({ cdId: alcance });
  const [resolver, setResolver] = useState<Solicitud | null>(null);
  const [respuesta, setRespuesta] = useState('');
  const [jornada, setJornada] = useState<Jornada | null>(null);
  const [crear, setCrear] = useState<Solicitud | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const lista = sols.datos.filter((s) =>
    tab === 'abierta' ? s.estado === 'abierta' : s.estado !== 'abierta',
  );

  const abrirJornada = async (s: Solicitud) => {
    if (!s.jornadaId) return setCrear(s);
    try {
      const d = await getDoc(ref.jornada(s.jornadaId));
      if (d.exists()) setJornada({ ...(d.data() as Jornada), id: d.id });
      else toast('Esa jornada ya no existe (venció la retención)', 'error');
    } catch (e) {
      toast(mensajeError(e), 'error');
    }
  };

  return (
    <>
      <Encabezado
        titulo="Solicitudes de corrección"
        sub="Pedidas por los guardias: olvidó marcar, hora incorrecta, etc."
      />
      <Card className="flex flex-col gap-2.5">
        <Tabs
          label="Estado"
          valor={tab}
          onChange={setTab}
          opciones={[
            {
              valor: 'abierta',
              texto: `Abiertas (${sols.datos.filter((s) => s.estado === 'abierta').length})`,
            },
            { valor: 'cerradas', texto: 'Cerradas' },
          ]}
        />
        {sols.error ? (
          <ErrorBox error={sols.error} />
        ) : sols.cargando ? (
          <Cargando />
        ) : lista.length === 0 ? (
          <Vacio titulo={tab === 'abierta' ? 'No hay solicitudes abiertas' : 'Sin solicitudes cerradas'} />
        ) : (
          lista.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3.5">
              <div className="flex-[1_1_280px]">
                <Link to={r(`guardia/${s.uid}`)} className="font-bold no-underline">
                  {s.nombre}
                </Link>{' '}
                · {cdNombre(s.cdId)}
                <div className="text-[13px]">
                  <b>{fechaCorta(s.fecha)}</b> · {TIPO_SOLICITUD[s.tipo]} · “{s.texto}”
                </div>
                <div className="text-xs text-muted">
                  Enviada {fechaHora(s.creadoEn)}
                  {s.respuesta ? ` · Respuesta: ${s.respuesta}` : ''}
                </div>
              </div>
              {s.estado === 'abierta' && esAdmin ? (
                <div className="flex flex-wrap gap-1.5">
                  <Button tamano="sm" variante="out" onClick={() => abrirJornada(s)}>
                    {s.jornadaId ? 'Corregir jornada' : 'Agregar jornada'}
                  </Button>
                  <Button
                    tamano="sm"
                    variante="pri"
                    onClick={() => {
                      setResolver(s);
                      setRespuesta('');
                    }}
                  >
                    Responder
                  </Button>
                </div>
              ) : (
                <Chip tono={ESTADO_SOLICITUD[s.estado].tono}>{ESTADO_SOLICITUD[s.estado].texto}</Chip>
              )}
            </div>
          ))
        )}
      </Card>
      <Dialog
        abierto={!!resolver}
        onCerrar={() => setResolver(null)}
        titulo="Responder solicitud"
        acciones={
          <>
            <Button onClick={() => setResolver(null)}>Cancelar</Button>
            {(['rechazada', 'resuelta'] as const).map((estado) => (
              <Button
                key={estado}
                variante={estado === 'resuelta' ? 'ok' : 'danger'}
                cargando={ocupado}
                onClick={async () => {
                  if (!resolver) return;
                  setOcupado(true);
                  try {
                    await resolverSolicitud(actor, resolver, estado, respuesta);
                    toast(estado === 'resuelta' ? 'Solicitud resuelta' : 'Solicitud rechazada', 'ok');
                    setResolver(null);
                  } catch (e) {
                    toast(mensajeError(e), 'error');
                  } finally {
                    setOcupado(false);
                  }
                }}
              >
                {estado === 'resuelta' ? 'Marcar resuelta' : 'Rechazar'}
              </Button>
            ))}
          </>
        }
      >
        <p className="m-0 text-muted">
          {resolver ? `${resolver.nombre} · ${fechaCorta(resolver.fecha)} · ${resolver.texto}` : ''}
        </p>
        <Field label="Respuesta para el guardia (opcional)">
          <textarea
            rows={3}
            className="input"
            value={respuesta}
            onChange={(e) => setRespuesta(e.target.value)}
            placeholder="Ej.: se corrigió con la hoja de papel"
          />
        </Field>
        <p className="m-0 text-xs text-muted">
          Primero corrige la jornada (queda en la bitácora) y luego márcala como resuelta.
        </p>
      </Dialog>
      <EditarJornada jornada={jornada} foco="salida" onCerrar={() => setJornada(null)} />
      {crear && <CrearJornada s={crear} onCerrar={() => setCrear(null)} />}
    </>
  );
}

function CrearJornada({ s, onCerrar }: { s: Solicitud; onCerrar: () => void }) {
  const { usuario, cd, actor } = usePanel();
  const { config } = useAuth();
  const toast = useToast();
  const g = usuario(s.uid);
  const c = cd(s.cdId);
  const [fecha, setFecha] = useState(s.fecha);
  const [turno, setTurno] = useState<NombreTurno>('Diurno');
  const [ent, setEnt] = useState('');
  const [sal, setSal] = useState('');
  const [motivo, setMotivo] = useState(`Solicitud del guardia: ${s.texto}`.slice(0, 200));
  const [error, setError] = useState<unknown>(null);
  const [guardando, setGuardando] = useState(false);
  if (!g || !c) return null;
  const t = c.turnos.find((x) => x.nombre === turno)!;
  return (
    <Dialog
      abierto
      onCerrar={onCerrar}
      titulo="Agregar jornada"
      acciones={
        <>
          <Button onClick={onCerrar}>Cancelar</Button>
          <Button
            variante="pri"
            cargando={guardando}
            onClick={async () => {
              const { entrada, salida } = horasAFechas(fecha, ent, sal);
              if (!entrada) return setError(new Error('Escribe la hora de entrada.'));
              if (motivo.trim().length < 3) return setError(new Error('Escribe el motivo.'));
              setGuardando(true);
              setError(null);
              try {
                await crearJornadaAdmin(actor, g, c, {
                  fecha,
                  turno: t,
                  entrada,
                  salida,
                  motivo: motivo.trim(),
                  diasRetencion: config.diasRetencion,
                });
                toast('Jornada agregada y registrada en la bitácora', 'ok');
                onCerrar();
              } catch (e) {
                setError(e);
              } finally {
                setGuardando(false);
              }
            }}
          >
            Guardar jornada
          </Button>
        </>
      }
    >
      <div className="-mt-2 text-muted">
        {g.nombre} {g.apellidos} · {c.nombre} {c.codigo}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Fecha de la entrada">
          <input
            type="date"
            className="input"
            value={fecha}
            max={fechaISO()}
            onChange={(e) => setFecha(e.target.value)}
          />
        </Field>
        <Field label="Turno">
          <select className="input" value={turno} onChange={(e) => setTurno(e.target.value as NombreTurno)}>
            {c.turnos.map((x) => (
              <option key={x.nombre} value={x.nombre}>
                {x.nombre} {x.inicio ? `(${x.inicio}–${x.fin})` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Entrada">
          <HoraInput className="input" value={ent} onChange={setEnt} data-autofocus />
        </Field>
        <Field label="Salida (opcional)">
          <HoraInput className="input" value={sal} onChange={setSal} />
        </Field>
      </div>
      <Field label="Motivo (obligatorio)">
        <textarea rows={2} className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {MOTIVOS_RAPIDOS.map((m) => (
          <Pill key={m} onClick={() => setMotivo((v) => (v ? `${v}. ${m}` : m))}>
            {m}
          </Pill>
        ))}
      </div>
      {error != null && <ErrorBox error={error} />}
    </Dialog>
  );
}
