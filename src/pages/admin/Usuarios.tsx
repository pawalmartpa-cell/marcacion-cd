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
  TablaWrap,
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

export function Usuarios() {
  const { usuarios, actor, r, cdNombre, cargandoUsuarios, alcance } = usePanel();
  const toast = useToast();
  const [tab, setTab] = useState<Pestana>('pendiente');
  const [borrar, setBorrar] = useState<{ u: Usuario; rechazo: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
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

  return (
    <>
      <Encabezado titulo="Usuarios" sub="Aprobar registros, roles, CD asignado y bloqueo" />
      <Card>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2.5">
          <Tabs
            label="Estado de los usuarios"
            valor={tab}
            onChange={setTab}
            opciones={[
              {
                valor: 'pendiente',
                texto: `Pendientes (${usuarios.filter((u) => u.estado === 'pendiente').length})`,
              },
              { valor: 'activo', texto: `Activos (${usuarios.filter((u) => u.estado === 'activo').length})` },
              {
                valor: 'bloqueado',
                texto: `Bloqueados (${usuarios.filter((u) => u.estado === 'bloqueado').length})`,
              },
              { valor: 'invitaciones', texto: `Invitaciones (${invsVis.length})` },
            ]}
          />
          <LinkButton variante="pri" to={r('usuarios/nuevo')}>
            + Nuevo usuario
          </LinkButton>
        </div>
        {cargandoUsuarios ? (
          <Cargando />
        ) : tab === 'invitaciones' ? (
          <TablaWrap>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>CD</th>
                <th>Creada</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invsVis.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted">
                    No hay invitaciones pendientes. Al crear un usuario se genera una invitación: la persona
                    entra con ese correo y queda activa.
                  </td>
                </tr>
              ) : (
                invsVis.map((i) => (
                  <tr key={i.email}>
                    <td className="font-bold">
                      {i.nombre} {i.apellidos}
                    </td>
                    <td className="text-muted">{i.email}</td>
                    <td>
                      <Chip tono={TONO_ROL[i.rol]}>{ROL_TEXTO[i.rol]}</Chip>
                    </td>
                    <td>{cdNombre(i.cdId)}</td>
                    <td>{fechaCorta(i.creadoEn)}</td>
                    <td>
                      <Button
                        tamano="sm"
                        variante="danger"
                        disabled={ocupado}
                        onClick={() => hacer(() => borrarInvitacion(actor, i.email), 'Invitación cancelada')}
                      >
                        Cancelar
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </TablaWrap>
        ) : (
          <TablaWrap>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>CD</th>
                <th>Acceso</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-muted">
                    No hay usuarios en esta pestaña.
                  </td>
                </tr>
              ) : (
                filas.map((u) => (
                  <tr key={u.uid}>
                    <td>
                      <Link to={r(`guardia/${u.uid}`)} className="font-bold no-underline">
                        {nombreCompleto(u)}
                      </Link>
                    </td>
                    <td className="text-muted">{u.email}</td>
                    <td>
                      <Chip tono={TONO_ROL[u.rol]}>{ROL_TEXTO[u.rol]}</Chip>
                    </td>
                    <td>{cdNombre(u.cdId)}</td>
                    <td>{u.proveedor === 'google' ? 'Google' : 'Correo'}</td>
                    <td>
                      <Chip tono={TONO_ESTADO[u.estado]}>{ESTADO_USUARIO_TEXTO[u.estado]}</Chip>
                    </td>
                    <td>
                      <div className="flex gap-1.5">
                        {u.estado === 'pendiente' ? (
                          <>
                            <Button
                              tamano="sm"
                              variante="ok"
                              disabled={ocupado}
                              onClick={() =>
                                hacer(
                                  () => cambiarEstadoUsuario(actor, u, 'activo'),
                                  `${nombreCompleto(u)} aprobado: ya puede marcar`,
                                )
                              }
                            >
                              Aprobar
                            </Button>
                            <Button
                              tamano="sm"
                              variante="danger"
                              disabled={ocupado}
                              onClick={() => setBorrar({ u, rechazo: true })}
                            >
                              Rechazar
                            </Button>
                          </>
                        ) : (
                          <>
                            <LinkButton tamano="sm" to={r(`usuarios/${u.uid}/editar`)}>
                              Editar
                            </LinkButton>
                            <Button
                              tamano="sm"
                              variante="danger"
                              disabled={ocupado || u.uid === actor.uid}
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
                              {u.estado === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}
                            </Button>
                          </>
                        )}
                        {u.estado !== 'pendiente' && (
                          <Button
                            tamano="sm"
                            aria-label={`Eliminar a ${nombreCompleto(u)}`}
                            disabled={u.uid === actor.uid}
                            onClick={() => setBorrar({ u, rechazo: false })}
                          >
                            <Icon n="x" size={16} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </TablaWrap>
        )}
      </Card>
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
