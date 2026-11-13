import { useState } from 'react';
import { useAuth, usePerfil, nombreCompleto } from '@/auth/AuthProvider';
import { ref } from '@/data/refs';
import { useDocumento } from '@/data/hooks';
import { actualizarNombre } from '@/data/servicios';
import { obtenerDeviceId, nombreDispositivo } from '@/lib/device';
import { guardarTemaLocal, temaLocal, type Tema } from '@/lib/tema';
import { fechaCorta } from '@/lib/fechas';
import { Avatar, Button, Card, CardHeader, Chip, Field, Pill, useToast, mensajeError } from '@/components/ui';
import { ROL_TEXTO, type Cd } from '@/types';

export function SelectorTema() {
  const { config } = useAuth();
  const [t, setT] = useState<Tema | null>(temaLocal);
  const op: Array<[Tema | null, string]> = [
    [null, `Como la app (${config.tema === 'auto' ? 'automático' : config.tema})`],
    ['claro', 'Claro'],
    ['oscuro', 'Oscuro'],
    ['auto', 'Automático'],
  ];
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tema de este dispositivo">
      {op.map(([v, txt]) => (
        <Pill
          key={txt}
          activo={t === v}
          onClick={() => {
            setT(v);
            guardarTemaLocal(v);
          }}
        >
          {txt}
        </Pill>
      ))}
    </div>
  );
}

export function PerfilGuardia() {
  const p = usePerfil();
  const { salir, usuario } = useAuth();
  const toast = useToast();
  const cd = useDocumento<Cd>(ref.cd(p.cdId));
  const [nombre, setNombre] = useState(p.nombre);
  const [apellidos, setApellidos] = useState(p.apellidos);
  const [guardando, setGuardando] = useState(false);
  const deviceId = obtenerDeviceId();

  return (
    <>
      <h1>Mi perfil</h1>
      <Card className="flex flex-col gap-3.5">
        <div className="flex items-center gap-3.5">
          <Avatar nombre={p.nombre} apellidos={p.apellidos} grande />
          <div className="min-w-0">
            <div className="truncate text-lg font-extrabold">{nombreCompleto(p)}</div>
            <div className="truncate text-muted">{p.email}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip tono="info">{ROL_TEXTO[p.rol]}</Chip>
          <Chip tono="ok">Activo</Chip>
          <Chip tono="neutral">{cd.datos ? `${cd.datos.nombre} ${cd.datos.codigo}` : p.cdId}</Chip>
          <Chip tono="neutral">Acceso: {p.proveedor === 'google' ? 'Google' : 'Correo'}</Chip>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre">
            <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Field>
          <Field label="Apellidos">
            <input className="input" value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
          </Field>
        </div>
        <Button
          variante="pri"
          cargando={guardando}
          disabled={!nombre.trim() || !apellidos.trim() || (nombre === p.nombre && apellidos === p.apellidos)}
          onClick={async () => {
            setGuardando(true);
            try {
              await actualizarNombre(p.uid, nombre, apellidos);
              toast('Perfil guardado', 'ok');
            } catch (e) {
              toast(mensajeError(e), 'error');
            } finally {
              setGuardando(false);
            }
          }}
        >
          Guardar
        </Button>
        <p className="text-xs text-muted">
          Registrado el {fechaCorta(p.creadoEn)}. Para cambiar de CD habla con un administrador.
        </p>
      </Card>
      <Card className="flex flex-col gap-2.5">
        <CardHeader titulo="Este teléfono" />
        <p className="text-[13px]">
          {nombreDispositivo()} ·{' '}
          {p.deviceId === deviceId ? (
            <Chip tono="ok">Teléfono registrado</Chip>
          ) : p.deviceIdPendiente === deviceId ? (
            <Chip tono="warn">Cambio pendiente de aprobación</Chip>
          ) : (
            <Chip tono="warn">No es tu teléfono registrado</Chip>
          )}
        </p>
        <p className="text-xs text-muted">
          Si cambias de teléfono, tus marcas quedan con observación hasta que el admin apruebe el cambio.
        </p>
      </Card>
      <Card className="flex flex-col gap-2.5">
        <CardHeader titulo="Apariencia" sub="Solo en este dispositivo" />
        <SelectorTema />
      </Card>
      <Button variante="danger" tamano="lg" onClick={() => salir()}>
        Cerrar sesión
      </Button>
      <p className="text-center text-xs text-muted">
        Versión {__APP_VERSION__} · {usuario?.email}
      </p>
    </>
  );
}
