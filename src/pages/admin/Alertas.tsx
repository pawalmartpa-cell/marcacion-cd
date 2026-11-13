import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ref } from '@/data/refs';
import { useDocumento } from '@/data/hooks';
import { useAlertas } from '@/data/consultas';
import { resolverAlerta } from '@/data/servicios';
import { fechaCorta, fechaHora, hora } from '@/lib/fechas';
import { distanciaTexto } from '@/lib/geo';
import { desfaseMin, horaEfectiva, metodoTexto } from '@/lib/jornada';
import { MapaCd } from '@/components/MapaCd';
import { Icon } from '@/components/Icon';
import {
  Button,
  Card,
  Cargando,
  Chip,
  ErrorBox,
  Field,
  LinkButton,
  Tabs,
  Vacio,
  mensajeError,
  useToast,
} from '@/components/ui';
import type { Alerta, Jornada } from '@/types';
import { usePanel } from './contexto';
import { Encabezado } from './Panel';
import { ChipSeveridad } from './comp/ChipsAlerta';
import { EditarJornada } from './comp/EditarJornada';

function ChipResuelta({ a }: { a: Alerta }) {
  return (
    <Chip tono={a.estado === 'aceptada' ? 'ok' : 'bad'}>
      {a.estado === 'aceptada' ? 'Marca aceptada' : 'Marca rechazada'}
    </Chip>
  );
}

export function Alertas() {
  const { alcance, actor, r, cdNombre } = usePanel();
  const toast = useToast();
  const [tab, setTab] = useState<'abiertas' | 'resueltas'>('abiertas');
  const alertas = useAlertas(alcance, { max: 300 });
  const [ocupado, setOcupado] = useState<string | null>(null);
  const lista = alertas.datos.filter((a) =>
    tab === 'abiertas' ? a.estado === 'abierta' : a.estado !== 'abierta',
  );

  const resolver = async (a: Alerta, estado: 'aceptada' | 'rechazada') => {
    setOcupado(a.id);
    try {
      await resolverAlerta(actor, a, estado, '');
      toast(estado === 'aceptada' ? 'Marca aceptada' : 'Marca rechazada', 'ok');
    } catch (e) {
      toast(mensajeError(e), 'error');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <>
      <Encabezado titulo="Alertas" sub="Marcas fuera del radio, desde otro teléfono o hechas sin conexión" />
      <Card className="flex flex-col gap-2.5">
        <Tabs
          label="Estado de las alertas"
          valor={tab}
          onChange={setTab}
          opciones={[
            {
              valor: 'abiertas',
              texto: `Abiertas (${alertas.datos.filter((a) => a.estado === 'abierta').length})`,
            },
            { valor: 'resueltas', texto: 'Resueltas' },
          ]}
        />
        {alertas.error ? (
          <ErrorBox error={alertas.error} />
        ) : alertas.cargando ? (
          <Cargando />
        ) : lista.length === 0 ? (
          <Vacio titulo={tab === 'abiertas' ? 'Sin alertas abiertas' : 'Sin alertas resueltas'} />
        ) : (
          lista.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3.5">
              <ChipSeveridad s={a.severidad} />
              <Link to={r(`alertas/${a.id}`)} className="flex-[1_1_260px] !text-inherit no-underline">
                <b>{a.nombre}</b> · {cdNombre(a.cdId)}
                <br />
                <span className="text-[13px] text-muted">
                  {a.texto} · {fechaHora(a.creadoEn)}
                </span>
                {a.estado !== 'abierta' && a.resueltoNombre && (
                  <span className="block text-xs text-muted">
                    {a.estado === 'aceptada' ? 'Aceptó' : 'Rechazó'}: {a.resueltoNombre}
                    {a.comentario ? ` · “${a.comentario}”` : ''}
                  </span>
                )}
              </Link>
              {a.estado === 'abierta' ? (
                <div className="flex flex-wrap gap-1.5">
                  <LinkButton tamano="sm" variante="out" to={r(`alertas/${a.id}`)}>
                    Ver en mapa
                  </LinkButton>
                  <Button
                    tamano="sm"
                    variante="ok"
                    disabled={ocupado === a.id}
                    onClick={() => resolver(a, 'aceptada')}
                  >
                    Aceptar
                  </Button>
                  <Button
                    tamano="sm"
                    variante="danger"
                    disabled={ocupado === a.id}
                    onClick={() => resolver(a, 'rechazada')}
                  >
                    Rechazar
                  </Button>
                </div>
              ) : (
                <ChipResuelta a={a} />
              )}
            </div>
          ))
        )}
      </Card>
    </>
  );
}

export function AlertaDetalle() {
  const { id = '' } = useParams();
  const { actor, r, cd, cdNombre, esAdmin, alcance } = usePanel();
  const toast = useToast();
  const alertas = useAlertas(alcance, { max: 300 });
  const aDoc = useDocumento<Alerta>(ref.alerta(id));
  const a = aDoc.datos ?? alertas.datos.find((x) => x.id === id) ?? null;
  const jDoc = useDocumento<Jornada>(a ? ref.jornada(a.jornadaId) : null);
  const [comentario, setComentario] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [editar, setEditar] = useState(false);

  if (aDoc.cargando) return <Cargando />;
  if (!a)
    return (
      <>
        <Encabezado titulo="Alerta no encontrada" sinFiltro />
        <Card>
          <Vacio titulo="La alerta no existe o ya fue borrada por la retención" />
        </Card>
      </>
    );
  const c = cd(a.cdId);
  const j = jDoc.datos;
  const m = j ? j[a.parte] : null;
  const resolver = async (estado: 'aceptada' | 'rechazada') => {
    if (estado === 'rechazada' && !comentario.trim()) {
      toast('Escribe un comentario para rechazar', 'error');
      document.getElementById('comentario-alerta')?.focus();
      return;
    }
    setOcupado(true);
    try {
      await resolverAlerta(actor, a, estado, comentario);
      toast(estado === 'aceptada' ? 'Marca aceptada' : 'Marca rechazada', 'ok');
    } catch (e) {
      toast(mensajeError(e), 'error');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      <Encabezado
        titulo={`Alerta ${a.severidad === 'alta' ? 'alta' : a.severidad === 'media' ? 'media' : 'informativa'} · ${a.nombre}`}
        sub={a.texto}
        crumb={
          <>
            <Link to={r('alertas')} className="no-underline">
              Alertas
            </Link>{' '}
            / Detalle
          </>
        }
        acciones={
          <LinkButton to={r('alertas')}>
            <Icon n="atras" size={16} />
            Volver
          </LinkButton>
        }
      />
      <div className="flex flex-wrap gap-4">
        <Card className="flex-[2_1_420px] overflow-hidden !p-0">
          {c ? (
            <MapaCd
              lat={c.ubicacion.latitude}
              lng={c.ubicacion.longitude}
              radioValido={c.radioValido}
              radioAlerta={c.radioAlerta}
              alto={340}
              punto={m?.lat != null && m?.lng != null ? { lat: m.lat, lng: m.lng } : null}
              etiqueta={`Mapa: dónde marcó ${a.nombre} respecto al CD`}
            />
          ) : (
            <Vacio titulo="CD sin ubicación" />
          )}
        </Card>
        <Card className="flex flex-[1_1_300px] flex-col gap-3">
          <h2>Detalle de la marca</h2>
          <table className="w-full text-[14px]">
            <tbody className="[&_td]:py-1.5 [&_td:first-child]:pr-3 [&_td:first-child]:text-muted">
              <tr>
                <td>Guardia</td>
                <td>
                  <Link to={r(`guardia/${a.uid}`)} className="font-bold">
                    {a.nombre}
                  </Link>
                </td>
              </tr>
              <tr>
                <td>CD</td>
                <td>{cdNombre(a.cdId)}</td>
              </tr>
              <tr>
                <td>Tipo</td>
                <td>
                  {a.parte === 'entrada' ? 'Entrada' : 'Salida'}
                  {j ? ` · ${j.turno.nombre}` : ''}
                </td>
              </tr>
              <tr>
                <td>Hora</td>
                <td className="tabular font-bold">
                  {m ? `${fechaCorta(horaEfectiva(m))} ${hora(horaEfectiva(m))}` : fechaHora(a.creadoEn)}
                </td>
              </tr>
              {m && desfaseMin(m) > 5 && (
                <tr>
                  <td>Enviada</td>
                  <td className="tabular">
                    {fechaHora(m.horaServidor)} (hora del celular {hora(m.horaDispositivo)})
                  </td>
                </tr>
              )}
              <tr>
                <td>Método</td>
                <td>{m ? metodoTexto(m) : '—'}</td>
              </tr>
              <tr>
                <td>Distancia al CD</td>
                <td className="font-bold">{distanciaTexto(m?.distanciaM ?? a.distanciaM)}</td>
              </tr>
              <tr>
                <td>Precisión GPS</td>
                <td>{m?.precision != null ? `± ${m.precision} m` : '—'}</td>
              </tr>
              <tr>
                <td>Dispositivo</td>
                <td>
                  {m ? (m.dispositivoDistinto ? 'Distinto al registrado' : 'El registrado del usuario') : '—'}
                </td>
              </tr>
            </tbody>
          </table>
          {esAdmin && j && (
            <Button variante="out" onClick={() => setEditar(true)}>
              Corregir esta jornada
            </Button>
          )}
          {a.estado === 'abierta' ? (
            <>
              <Field label="Comentario (obligatorio para rechazar)">
                <textarea
                  id="comentario-alerta"
                  rows={3}
                  className="input"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Ej.: se confirmó con la hoja de papel"
                />
              </Field>
              <div className="flex gap-2">
                <Button
                  variante="ok"
                  className="flex-1"
                  disabled={ocupado}
                  onClick={() => resolver('aceptada')}
                >
                  Aceptar marca
                </Button>
                <Button
                  variante="danger"
                  className="flex-1"
                  disabled={ocupado}
                  onClick={() => resolver('rechazada')}
                >
                  Rechazar
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <ChipResuelta a={a} />
              <span className="text-xs text-muted">
                {a.resueltoNombre} · {fechaHora(a.resueltoEn)}
                {a.comentario ? ` · “${a.comentario}”` : ''}
              </span>
            </div>
          )}
        </Card>
      </div>
      {editar && j && <EditarJornada jornada={j} foco={a.parte} onCerrar={() => setEditar(false)} />}
    </>
  );
}
