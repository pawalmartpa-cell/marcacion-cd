import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { nombreCompleto } from '@/auth/AuthProvider';
import { useInvitaciones } from '@/data/consultas';
import {
  borrarInvitacion,
  cambiarEstadoUsuario,
  crearInvitacion,
  editarUsuario,
  eliminarUsuario,
} from '@/data/servicios';
import { fechaCorta } from '@/lib/fechas';
import { Icon } from '@/components/Icon';
import {
  Button,
  Card,
  Cargando,
  Chip,
  Dialog,
  ErrorBox,
  Field,
  LinkButton,
  Avatar,
  Vacio,
  Tabs,
  mensajeError,
  useToast,
  type TonoChip,
} from '@/components/ui';
import { ESTADO_USUARIO_TEXTO, ROL_TEXTO, type EstadoUsuario, type Rol, type Usuario } from '@/types';
import { usePanel } from './contexto';
import { Encabezado } from './Panel';

export const TONO_ROL: Record<Rol, TonoChip> = { seguridad: 'info', pa: 'yel', kiosco: 'pur', admin: 'navy' };
export const TONO_ESTADO: Record<EstadoUsuario, TonoChip> = {
  pendiente: 'warn',
  activo: 'ok',
  bloqueado: 'bad',
};

type Pestana = EstadoUsuario | 'invitaciones';

function Contador({ txt, n, alerta }: { txt: string; n: number; alerta?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {txt}
      <span
        className={
          'rounded-full px-1.5 text-[11px] font-extrabold leading-[18px] ' +
          (alerta && n > 0 ? 'bg-wm-yellow text-wm-navy' : 'bg-line/70 text-muted')
        }
      >
        {n}
      </span>
    </span>
  );
}

export function Usuarios() {
  const { usuarios, actor, r, cdNombre, cargandoUsuarios, alcance } = usePanel();
  const toast = useToast();
  const [tab, setTab] = useState<Pestana>('pendiente');
  const [borrar, setBorrar] = useState<{ u: Usuario; rechazo: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const invs = useInvitaciones(true);
  const invsVis = invs.datos.filter((i) => !alcance || i.cdId === alcance);
  const filas = usuarios.filter((u) => u.estado === tab);

  const hacer = async (f: () => Promise<unknown>, ok: string) => {
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

  const q = busqueda.trim().toLowerCase();
  const coincide = (t: string) => !q || t.toLowerCase().includes(q);
  const visibles = filas.filter((u) => coincide(`${nombreCompleto(u)} ${u.email}`));
  const invsFiltradas = invsVis.filter((i) => coincide(`${i.nombre} ${i.apellidos} ${i.email}`));
  const cuenta = (e: EstadoUsuario) => usuarios.filter((u) => u.estado === e).length;

  return (
    <>
      <Encabezado titulo="Usuarios" sub="Aprobar registros, roles, CD asignado y bloqueo" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Tabs
            label="Estado de los usuarios"
            valor={tab}
            onChange={setTab}
            opciones={[
              { valor: 'pendiente', texto: <Contador txt="Pendientes" n={cuenta('pendiente')} alerta /> },
              { valor: 'activo', texto: <Contador txt="Activos" n={cuenta('activo')} /> },
              { valor: 'bloqueado', texto: <Contador txt="Bloqueados" n={cuenta('bloqueado')} /> },
              { valor: 'invitaciones', texto: <Contador txt="Invitaciones" n={invsVis.length} /> },
            ]}
          />
        </div>
        <div className="flex flex-1 gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Buscar usuario</span>
            <Icon
              n="buscar"
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o correo"
              className="input !h-10 !pl-9"
            />
          </label>
          <LinkButton
            variante="pri"
            to={r('usuarios/nuevo')}
            className="!h-10 shrink-0"
            aria-label="Nuevo usuario"
          >
            <Icon n="mas" size={18} />
            <span className="hidden sm:inline">Nuevo usuario</span>
          </LinkButton>
        </div>
      </div>
      {cargandoUsuarios ? (
        <Cargando />
      ) : tab === 'invitaciones' ? (
        invsFiltradas.length === 0 ? (
          <Card>
            <Vacio titulo="No hay invitaciones pendientes">
              Al crear un usuario se genera una invitación: la persona entra con ese correo y queda activa con
              el rol elegido.
            </Vacio>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {invsFiltradas.map((i) => (
              <article key={i.email} className="card flex flex-col gap-3 !p-4">
                <div className="flex items-start gap-3">
                  <Avatar nombre={i.nombre} apellidos={i.apellidos} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">
                      {i.nombre} {i.apellidos}
                    </div>
                    <div className="truncate text-[13px] text-muted">{i.email}</div>
                  </div>
                  <Chip tono="info">Invitado</Chip>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Chip tono={TONO_ROL[i.rol]}>{ROL_TEXTO[i.rol]}</Chip>
                  <Chip tono="neutral">{cdNombre(i.cdId)}</Chip>
                  <Chip tono="neutral">Desde {fechaCorta(i.creadoEn)}</Chip>
                </div>
                <div className="border-t border-line pt-3">
                  <Button
                    tamano="sm"
                    variante="danger"
                    className="w-full"
                    disabled={ocupado}
                    onClick={() => hacer(() => borrarInvitacion(actor, i.email), 'Invitación cancelada')}
                  >
                    Cancelar invitación
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )
      ) : visibles.length === 0 ? (
        <Card>
          <Vacio titulo={q ? 'Nadie coincide con la búsqueda' : 'No hay usuarios en esta pestaña'}>
            {tab === 'pendiente' && !q
              ? 'Cuando un guardia se registre aparecerá aquí para aprobarlo.'
              : undefined}
          </Vacio>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibles.map((u) => {
            const yo = u.uid === actor.uid;
            return (
              <article key={u.uid} className="card flex flex-col gap-3 !p-4">
                <div className="flex items-start gap-3">
                  <Avatar nombre={u.nombre} apellidos={u.apellidos} />
                  <div className="min-w-0 flex-1">
                    <Link to={r(`guardia/${u.uid}`)} className="block truncate font-bold no-underline">
                      {nombreCompleto(u)}
                      {yo && <span className="font-semibold text-muted"> (tú)</span>}
                    </Link>
                    <div className="truncate text-[13px] text-muted">{u.email}</div>
                  </div>
                  <Chip tono={TONO_ESTADO[u.estado]}>{ESTADO_USUARIO_TEXTO[u.estado]}</Chip>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Chip tono={TONO_ROL[u.rol]}>{ROL_TEXTO[u.rol]}</Chip>
                  <Chip tono="neutral">{cdNombre(u.cdId)}</Chip>
                  <Chip tono="neutral">{u.proveedor === 'google' ? 'Google' : 'Correo'}</Chip>
                  {u.deviceIdPendiente && <Chip tono="warn">Cambio de teléfono</Chip>}
                  {u.rol === 'seguridad' && !u.firma && <Chip tono="warn">Sin firma</Chip>}
                </div>
                <div className="mt-auto flex gap-2 border-t border-line pt-3">
                  {u.estado === 'pendiente' ? (
                    <>
                      <Button
                        tamano="sm"
                        variante="ok"
                        className="flex-1"
                        disabled={ocupado}
                        onClick={() =>
                          hacer(
                            () => cambiarEstadoUsuario(actor, u, 'activo'),
                            `${nombreCompleto(u)} aprobado: ya puede marcar`,
                          )
                        }
                      >
                        <Icon n="check" size={16} />
                        Aprobar
                      </Button>
                      <Button
                        tamano="sm"
                        variante="danger"
                        className="flex-1"
                        disabled={ocupado}
                        onClick={() => setBorrar({ u, rechazo: true })}
                      >
                        <Icon n="x" size={16} />
                        Rechazar
                      </Button>
                    </>
                  ) : (
                    <>
                      <LinkButton tamano="sm" className="flex-1" to={r(`usuarios/${u.uid}/editar`)}>
                        <Icon n="editar" size={16} />
                        Editar
                      </LinkButton>
                      <Button
                        tamano="sm"
                        variante={u.estado === 'bloqueado' ? 'ok' : 'default'}
                        className="flex-1"
                        disabled={ocupado || yo}
                        onClick={() =>
                          hacer(
                            () =>
                              cambiarEstadoUsuario(
                                actor,
                                u,
                                u.estado === 'bloqueado' ? 'activo' : 'bloqueado',
                              ),
                            u.estado === 'bloqueado'
                              ? `${nombreCompleto(u)} desbloqueado`
                              : `${nombreCompleto(u)} bloqueado: no puede entrar ni marcar`,
                          )
                        }
                      >
                        <Icon n="candado" size={16} />
                        {u.estado === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}
                      </Button>
                      <Button
                        tamano="sm"
                        variante="danger"
                        className="!px-2.5"
                        aria-label={`Eliminar a ${nombreCompleto(u)}`}
                        disabled={yo}
                        onClick={() => setBorrar({ u, rechazo: false })}
                      >
                        <Icon n="basura" size={16} />
                      </Button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Dialog
        abierto={!!borrar}
        onCerrar={() => setBorrar(null)}
        titulo={
          borrar
            ? borrar.rechazo
              ? `¿Rechazar el registro de ${nombreCompleto(borrar.u)}?`
              : `¿Eliminar a ${nombreCompleto(borrar.u)}?`
            : ''
        }
        ancho="sm"
        acciones={
          <>
            <Button onClick={() => setBorrar(null)}>Cancelar</Button>
            <Button
              variante="danger"
              cargando={ocupado}
              onClick={async () => {
                if (!borrar) return;
                await hacer(
                  () => eliminarUsuario(actor, borrar.u, borrar.rechazo),
                  borrar.rechazo ? 'Registro rechazado' : 'Usuario eliminado',
                );
                setBorrar(null);
              }}
            >
              {borrar?.rechazo ? 'Rechazar' : 'Eliminar'}
            </Button>
          </>
        }
      >
        <p className="m-0 text-muted">
          Se borra su perfil. Sus marcaciones se conservan hasta que venza la retención. Si vuelve a entrar
          con su cuenta quedará otra vez pendiente; para impedir el acceso usa “Bloquear”.
        </p>
      </Dialog>
    </>
  );
}

const esquema = z.object({
  nombre: z.string().trim().min(1, 'Requerido').max(60),
  apellidos: z.string().trim().min(1, 'Requerido').max(60),
  email: z.string().trim().email('Correo no válido'),
  rol: z.enum(['seguridad', 'pa', 'kiosco', 'admin']),
  cdId: z.string().min(1, 'Elige un CD'),
});
type Datos = z.infer<typeof esquema>;

export function UsuarioForm() {
  const { uid } = useParams();
  const { usuario, cds, actor, r } = usePanel();
  const nav = useNavigate();
  const toast = useToast();
  const [error, setError] = useState<unknown>(null);
  const u = uid ? usuario(uid) : undefined;
  const nuevo = !uid;
  const { register, handleSubmit, formState } = useForm<Datos>({
    resolver: zodResolver(esquema),
    values: u
      ? { nombre: u.nombre, apellidos: u.apellidos, email: u.email, rol: u.rol, cdId: u.cdId }
      : { nombre: '', apellidos: '', email: '', rol: 'seguridad', cdId: cds[0]?.id ?? '' },
  });

  if (!nuevo && !u) return <Cargando />;

  const enviar = handleSubmit(async (d) => {
    setError(null);
    try {
      if (nuevo) {
        await crearInvitacion(actor, d);
        toast('Invitación creada: la persona debe entrar con ese correo', 'ok');
      } else {
        // Un admin no puede quitarse su propio rol.
        await editarUsuario(actor, u!, u!.uid === actor.uid ? { ...d, rol: u!.rol } : d);
        toast('Cambios guardados', 'ok');
      }
      nav(r('usuarios'));
    } catch (e) {
      setError(e);
    }
  });

  return (
    <>
      <Encabezado
        titulo={nuevo ? 'Nuevo usuario' : 'Editar usuario'}
        sub={
          nuevo
            ? 'Se crea una invitación: la persona entra con Google o se registra con este correo y queda activa'
            : nombreCompleto(u!)
        }
        crumb={
          <>
            <Link to={r('usuarios')} className="no-underline">
              Usuarios
            </Link>{' '}
            / {nuevo ? 'Nuevo' : 'Editar'}
          </>
        }
        acciones={
          <LinkButton to={r('usuarios')}>
            <Icon n="atras" size={16} />
            Volver
          </LinkButton>
        }
      />
      <form className="card flex max-w-[640px] flex-col gap-3.5" onSubmit={enviar} noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre" error={formState.errors.nombre?.message}>
            <input className="input" placeholder="Ej.: Karla" {...register('nombre')} />
          </Field>
          <Field label="Apellidos" error={formState.errors.apellidos?.message}>
            <input className="input" placeholder="Ej.: Morales" {...register('apellidos')} />
          </Field>
        </div>
        <Field
          label="Correo"
          error={formState.errors.email?.message}
          ayuda={
            nuevo
              ? 'Debe ser el correo con el que va a entrar (Gmail o el que use para registrarse).'
              : 'El correo no se puede cambiar.'
          }
        >
          <input
            type="email"
            className="input"
            placeholder="correo@gmail.com"
            readOnly={!nuevo}
            {...register('email')}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Rol">
            <select
              className={'input' + (!nuevo && u?.uid === actor.uid ? ' pointer-events-none opacity-70' : '')}
              aria-readonly={(!nuevo && u?.uid === actor.uid) || undefined}
              {...register('rol')}
            >
              {(['seguridad', 'pa', 'kiosco', 'admin'] as Rol[]).map((x) => (
                <option key={x} value={x}>
                  {ROL_TEXTO[x]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Centro de distribución" error={formState.errors.cdId?.message}>
            <select className="input" {...register('cdId')}>
              {cds.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.codigo}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="rounded-xl bg-track p-3 text-[13px] text-muted">
          <b className="text-text">Permisos del rol:</b> Seguridad marca entrada/salida y firma · PA ve solo
          su CD, reportes y alertas · Kiosco QR solo muestra el código · Admin controla todo.
        </div>
        {error != null && <ErrorBox error={error} />}
        <div className="flex justify-end gap-2">
          <LinkButton to={r('usuarios')}>Cancelar</LinkButton>
          <Button type="submit" variante="pri" cargando={formState.isSubmitting}>
            {nuevo ? 'Crear usuario' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </>
  );
}
