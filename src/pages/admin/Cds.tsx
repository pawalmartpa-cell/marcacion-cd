import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { nombreCompleto } from '@/auth/AuthProvider';
import { guardarCd } from '@/data/servicios';
import { obtenerUbicacion } from '@/lib/geo';
import { MapaCd } from '@/components/MapaCd';
import { Icon } from '@/components/Icon';
import {
  Button,
  Card,
  CardHeader,
  Cargando,
  Chip,
  ErrorBox,
  Field,
  LinkButton,
  TablaWrap,
  Vacio,
  mensajeError,
  useToast,
  type TonoChip,
} from '@/components/ui';
import { ESTADO_USUARIO_TEXTO, NOMBRES_TURNO, type NombreTurno, type Turno } from '@/types';
import { usePanel } from './contexto';
import { HoraInput } from '@/components/HoraInput';
import { Encabezado } from './Panel';
import { TONO_ESTADO } from './Usuarios';

export const TONO_TURNO: Record<NombreTurno, TonoChip> = {
  Diurno: 'yel',
  Vespertino: 'warn',
  Nocturno: 'info',
};

export function Cds() {
  const { cds, alcance, usuarios, usuario, r, cargandoCds } = usePanel();
  const lista = cds.filter((c) => !alcance || c.id === alcance);
  return (
    <>
      <Encabezado
        titulo="Centros de distribución"
        sub="Geocerca de 150 m, alerta a más de 1 km y turnos por CD"
      />
      <div className="mb-3 flex justify-end">
        <LinkButton variante="pri" to={r('cds/nuevo')}>
          + Agregar CD
        </LinkButton>
      </div>
      {cargandoCds ? (
        <Cargando />
      ) : lista.length === 0 ? (
        <Card>
          <Vacio titulo="Aún no hay centros de distribución">Agrega el primero con “+ Agregar CD”.</Vacio>
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3.5">
          {lista.map((c) => {
            const guardias = usuarios.filter((u) => u.cdId === c.id && u.rol === 'seguridad').length;
            const pa = c.paUids.map((id) => usuario(id)).filter(Boolean);
            return (
              <Link
                key={c.id}
                to={r(`cds/${c.id}`)}
                className="card flex flex-col overflow-hidden !p-0 !text-inherit no-underline hover:border-wm-blue"
              >
                <div className="pointer-events-none">
                  <MapaCd
                    lat={c.ubicacion.latitude}
                    lng={c.ubicacion.longitude}
                    radioValido={c.radioValido}
                    radioAlerta={c.radioAlerta}
                    alto={140}
                  />
                </div>
                <div className="flex flex-col gap-2.5 p-4">
                  <div className="flex items-baseline justify-between">
                    <b className="text-[17px]">{c.nombre}</b>
                    <span className="text-muted">Código {c.codigo}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.turnos.map((t) => (
                      <Chip key={t.nombre} tono={TONO_TURNO[t.nombre]}>
                        {t.nombre}
                      </Chip>
                    ))}
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span>PA: {pa.length ? pa.map((u) => nombreCompleto(u)).join(', ') : 'Sin asignar'}</span>
                    <span className="text-muted">{guardias} guardias</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

const TURNOS_VACIOS: Turno[] = NOMBRES_TURNO.map((nombre) => ({ nombre, inicio: '', fin: '' }));
const CENTRO_SV = { lat: 13.7, lng: -89.2 };

export function CdDetalle({ nuevo }: { nuevo?: boolean }) {
  const { id = '' } = useParams();
  const { cd: buscarCd, usuarios, actor, r, cargandoCds } = usePanel();
  const nav = useNavigate();
  const toast = useToast();
  const c = nuevo ? undefined : buscarCd(id);
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [lat, setLat] = useState(CENTRO_SV.lat);
  const [lng, setLng] = useState(CENTRO_SV.lng);
  const [radioValido, setRadioValido] = useState(150);
  const [radioAlerta, setRadioAlerta] = useState(1000);
  const [turnos, setTurnos] = useState<Turno[]>(TURNOS_VACIOS);
  const [tolerancia, setTolerancia] = useState(10);
  const [pa, setPa] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [ubicando, setUbicando] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!c) return;
    setNombre(c.nombre);
    setCodigo(c.codigo);
    setLat(c.ubicacion.latitude);
    setLng(c.ubicacion.longitude);
    setRadioValido(c.radioValido);
    setRadioAlerta(c.radioAlerta);
    setTurnos(
      NOMBRES_TURNO.map((n) => c.turnos.find((t) => t.nombre === n) ?? { nombre: n, inicio: '', fin: '' }),
    );
    setTolerancia(c.toleranciaMin);
    setPa(c.paUids[0] ?? '');
  }, [c]);

  if (!nuevo && cargandoCds) return <Cargando />;
  if (!nuevo && !c)
    return (
      <>
        <Encabezado titulo="CD no encontrado" sinFiltro />
        <Card>
          <Vacio titulo="Ese centro de distribución no existe" />
        </Card>
      </>
    );

  const pas = usuarios.filter((u) => u.rol === 'pa' && u.estado === 'activo');
  const guardias = c ? usuarios.filter((u) => u.cdId === c.id && u.rol === 'seguridad') : [];
  const mover = (la: number, ln: number) => {
    setLat(Number(la.toFixed(6)));
    setLng(Number(ln.toFixed(6)));
  };

  async function guardar() {
    setError(null);
    if (!nombre.trim() || !codigo.trim()) return setError(new Error('Escribe el nombre y el código del CD.'));
    if (!/^[A-Za-z0-9-]{1,20}$/.test(codigo.trim()))
      return setError(new Error('El código solo puede tener letras, números o guiones.'));
    if (radioAlerta <= radioValido)
      return setError(new Error('La distancia de alerta debe ser mayor que el radio válido.'));
    if (nuevo && buscarCd(codigo.trim())) return setError(new Error('Ya existe un CD con ese código.'));
    setGuardando(true);
    try {
      await guardarCd(
        actor,
        {
          nombre,
          codigo,
          lat,
          lng,
          radioValido,
          radioAlerta,
          turnos,
          toleranciaMin: tolerancia,
          paUids: pa ? [pa] : [],
        },
        c ?? null,
      );
      toast(nuevo ? 'CD agregado' : 'Cambios del CD guardados', 'ok');
      if (nuevo) nav(r('cds'));
    } catch (e) {
      setError(e);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Encabezado
        titulo={nuevo ? 'Agregar centro de distribución' : `${c!.nombre} · ${c!.codigo}`}
        sub={nuevo ? 'El punto del mapa define la geocerca' : 'Geocerca, turnos, PA asignado y kiosco'}
        crumb={
          <>
            <Link to={r('cds')} className="no-underline">
              Centros de distribución
            </Link>{' '}
            / {nuevo ? 'Nuevo' : 'Detalle'}
          </>
        }
        acciones={
          <LinkButton to={r('cds')}>
            <Icon n="atras" size={16} />
            Volver
          </LinkButton>
        }
      />
      <div className="flex flex-wrap gap-4">
        <Card className="flex-[2_1_420px] overflow-hidden !p-0">
          <MapaCd
            lat={lat}
            lng={lng}
            radioValido={radioValido}
            radioAlerta={radioAlerta}
            alto={320}
            editable
            onMover={mover}
          />
          <div className="flex flex-col gap-3 p-4">
            {nuevo && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nombre">
                  <input
                    className="input"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej.: Lourdes"
                  />
                </Field>
                <Field label="Código">
                  <input
                    className="input"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="Ej.: 7xxx"
                  />
                </Field>
              </div>
            )}
            {!nuevo && (
              <Field label="Nombre">
                <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </Field>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Latitud">
                <input
                  className="input tabular"
                  type="number"
                  step="0.000001"
                  value={lat}
                  onChange={(e) => setLat(Number(e.target.value))}
                />
              </Field>
              <Field label="Longitud">
                <input
                  className="input tabular"
                  type="number"
                  step="0.000001"
                  value={lng}
                  onChange={(e) => setLng(Number(e.target.value))}
                />
              </Field>
            </div>
            <Button
              variante="out"
              cargando={ubicando}
              onClick={async () => {
                setUbicando(true);
                try {
                  const l = await obtenerUbicacion();
                  mover(l.lat, l.lng);
                  toast(`Ubicación tomada (precisión ${l.precision} m)`, 'ok');
                } catch (e) {
                  toast(mensajeError(e), 'error');
                } finally {
                  setUbicando(false);
                }
              }}
            >
              <Icon n="ubicacion" /> Usar mi ubicación actual
            </Button>
            <span className="text-xs text-muted">
              También puedes tocar el mapa o arrastrar el punto azul marino.
            </span>
            <Field label={`Radio de marca válida: ${radioValido} m`}>
              <input
                type="range"
                min={50}
                max={500}
                step={10}
                value={radioValido}
                onChange={(e) => setRadioValido(Number(e.target.value))}
                className="accent-wm-blue"
              />
            </Field>
            <Field label="Alerta a partir de (m)">
              <input
                className="input"
                type="number"
                min={radioValido + 10}
                max={20000}
                step={50}
                value={radioAlerta}
                onChange={(e) => setRadioAlerta(Number(e.target.value))}
              />
            </Field>
            <div className="text-xs text-muted">
              Entre el radio y la distancia de alerta la marca queda con observación. Más lejos se envía
              alerta a PA y admin.
            </div>
          </div>
        </Card>
        <Card className="flex flex-[1_1_300px] flex-col gap-3.5">
          <h2>Turnos del CD</h2>
          {turnos.map((t, i) => (
            <div key={t.nombre} className="flex items-center gap-2.5">
              <Chip tono={TONO_TURNO[t.nombre]} className="w-24 text-center">
                {t.nombre}
              </Chip>
              <HoraInput
                aria-label={`Inicio ${t.nombre}`}
                className="input !h-[38px] !px-2"
                value={t.inicio}
                onChange={(v) => setTurnos((ts) => ts.map((x, j) => (j === i ? { ...x, inicio: v } : x)))}
              />
              <span className="text-muted">a</span>
              <HoraInput
                aria-label={`Fin ${t.nombre}`}
                className="input !h-[38px] !px-2"
                value={t.fin}
                onChange={(v) => setTurnos((ts) => ts.map((x, j) => (j === i ? { ...x, fin: v } : x)))}
              />
            </div>
          ))}
          <div className="text-xs text-muted">
            El guardia elige su turno al marcar y el rango se toma de aquí. Si cambias un horario, las
            jornadas ya marcadas conservan el anterior.
          </div>
          <Field label="Tolerancia de llegada tarde (minutos)">
            <input
              className="input"
              type="number"
              min={0}
              max={120}
              value={tolerancia}
              onChange={(e) => setTolerancia(Math.max(0, Math.min(120, Math.round(Number(e.target.value)))))}
            />
          </Field>
          <Field label="PA asignado">
            <select className="input" value={pa} onChange={(e) => setPa(e.target.value)}>
              <option value="">Sin asignar</option>
              {pas.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {nombreCompleto(u)}
                </option>
              ))}
            </select>
          </Field>
          {!nuevo && (
            <div className="flex items-center justify-between">
              <span>
                <b>Kiosco QR</b>
                <br />
                <span className="text-xs text-muted">
                  {c!.qrHabilitado ? `Habilitado · cambia cada ${c!.qrRotacionSeg} s` : 'Deshabilitado'}
                </span>
              </span>
              <LinkButton tamano="sm" variante="out" to={r('qr')}>
                Configurar
              </LinkButton>
            </div>
          )}
          {error != null && <ErrorBox error={error} />}
          <Button variante="pri" onClick={guardar} cargando={guardando}>
            {nuevo ? 'Crear CD' : 'Guardar cambios'}
          </Button>
        </Card>
      </div>
      {!nuevo && (
        <Card className="mt-4">
          <CardHeader titulo={`Guardias de este CD (${guardias.length})`} />
          <TablaWrap>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Firma</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {guardias.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted">
                    Sin guardias asignados.
                  </td>
                </tr>
              )}
              {guardias.map((u) => (
                <tr key={u.uid} className="click" onClick={() => nav(r(`guardia/${u.uid}`))}>
                  <td>
                    <b>{nombreCompleto(u)}</b>
                  </td>
                  <td>
                    <Chip tono={TONO_ESTADO[u.estado]}>{ESTADO_USUARIO_TEXTO[u.estado]}</Chip>
                  </td>
                  <td>{u.firma ? 'Registrada' : <span className="text-muted">Pendiente</span>}</td>
                  <td className="text-right text-muted">Ver ›</td>
                </tr>
              ))}
            </tbody>
          </TablaWrap>
        </Card>
      )}
    </>
  );
}
