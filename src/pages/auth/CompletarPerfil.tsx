import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { sendEmailVerification } from 'firebase/auth';
import { useAuth } from '@/auth/AuthProvider';
import { useCds } from '@/data/consultas';
import { buscarInvitacion, crearPerfil } from '@/data/servicios';
import { FirmaEditor, type FirmaBorrador } from '@/components/FirmaEditor';
import { Button, Cargando, ErrorBox, Field, useToast } from '@/components/ui';
import { ROL_TEXTO, type Invitacion } from '@/types';
import { AuthLayout, inputClaro } from './AuthLayout';

const esquema = z.object({
  nombre: z.string().trim().min(1, 'Escribe tu nombre').max(60),
  apellidos: z.string().trim().min(1, 'Escribe tus apellidos').max(60),
  cdId: z.string().min(1, 'Elige tu centro de distribución'),
  consentimiento: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar para poder marcar' }) }),
});
type Datos = z.infer<typeof esquema>;

export function CompletarPerfil() {
  const { usuario, salir, recargarUsuario } = useAuth();
  const toast = useToast();
  const cds = useCds();
  const [inv, setInv] = useState<Invitacion | null | undefined>(undefined);
  const [firma, setFirma] = useState<FirmaBorrador | null>(null);
  const [errorFirma, setErrorFirma] = useState('');
  const [error, setError] = useState<unknown>(null);
  const nombreGoogle = usuario?.displayName?.split(' ') ?? [];
  const { register, handleSubmit, formState, watch, setValue } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      nombre: nombreGoogle.slice(0, Math.ceil(nombreGoogle.length / 2)).join(' '),
      apellidos: nombreGoogle.slice(Math.ceil(nombreGoogle.length / 2)).join(' '),
      cdId: '',
    },
  });

  useEffect(() => {
    buscarInvitacion(usuario?.email ?? null).then((i) => {
      setInv(i);
      if (i) {
        setValue('nombre', i.nombre);
        setValue('apellidos', i.apellidos);
        setValue('cdId', i.cdId);
      }
    });
  }, [usuario?.email, setValue]);

  const onFirma = useCallback((f: FirmaBorrador | null) => {
    setFirma(f);
    if (f) setErrorFirma('');
  }, []);

  if (!usuario) return null;
  const invitadoVerificado = !!inv && usuario.emailVerified;
  const firmaObligatoria = !invitadoVerificado || inv?.rol === 'seguridad';
  const nombre = `${watch('nombre') ?? ''} ${watch('apellidos') ?? ''}`.trim();

  const enviar = handleSubmit(async (d) => {
    setError(null);
    if (firmaObligatoria && !firma) {
      setErrorFirma('Crea tu firma: dibújala o elige un estilo.');
      return;
    }
    try {
      await crearPerfil(
        usuario,
        { nombre: d.nombre, apellidos: d.apellidos, cdId: d.cdId, firma },
        inv ?? null,
      );
      toast(invitadoVerificado ? 'Perfil creado' : 'Perfil enviado: espera la aprobación', 'ok');
    } catch (e) {
      setError(e);
    }
  });

  return (
    <AuthLayout ancho={520}>
      <div>
        <h1 className="text-xl">Completa tu perfil</h1>
        <p className="text-[13px] text-[#54627A]">{usuario.email}</p>
      </div>
      {inv === undefined || cds.cargando ? (
        <Cargando />
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-3.5" noValidate>
          {inv && !usuario.emailVerified && (
            <div
              className="flex flex-col gap-2 rounded-xl bg-[#E6F0FB] p-3 text-[13px] text-[#004F9A]"
              role="status"
            >
              <b>Tienes una invitación como {ROL_TEXTO[inv.rol]}.</b>
              <span>
                Para activarla, abre el enlace que enviamos a tu correo y luego toca "Ya verifiqué".
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  tamano="sm"
                  onClick={() => sendEmailVerification(usuario).then(() => toast('Correo reenviado'))}
                >
                  Reenviar correo
                </Button>
                <Button tamano="sm" variante="pri" onClick={() => recargarUsuario()}>
                  Ya verifiqué
                </Button>
              </div>
            </div>
          )}
          {invitadoVerificado && (
            <div
              className="rounded-xl bg-[#E7F7EE] p-3 text-[13px] font-semibold text-[#0B6B3A]"
              role="status"
            >
              Invitación encontrada: entrarás como {ROL_TEXTO[inv!.rol]} sin esperar aprobación.
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre" error={formState.errors.nombre?.message}>
              <input autoComplete="given-name" className={inputClaro} {...register('nombre')} />
            </Field>
            <Field label="Apellidos" error={formState.errors.apellidos?.message}>
              <input autoComplete="family-name" className={inputClaro} {...register('apellidos')} />
            </Field>
          </div>
          <Field label="Centro de distribución" error={formState.errors.cdId?.message}>
            <select
              className={inputClaro + (invitadoVerificado ? ' pointer-events-none opacity-70' : '')}
              aria-readonly={invitadoVerificado || undefined}
              tabIndex={invitadoVerificado ? -1 : undefined}
              {...register('cdId')}
            >
              <option value="">Elige tu CD…</option>
              {cds.datos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.codigo}
                </option>
              ))}
            </select>
          </Field>
          {!cds.datos.length && (
            <p className="text-[13px] text-[#9B1C10]">
              Aún no hay centros de distribución. Pide a un administrador que los cree.
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Firma {firmaObligatoria ? '' : '(opcional)'}</span>
            <FirmaEditor nombre={nombre} onChange={onFirma} />
            {errorFirma && (
              <span className="text-xs font-semibold text-[#9B1C10]" role="alert">
                {errorFirma}
              </span>
            )}
          </div>
          <label className="flex items-start gap-2.5 text-[13px]">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#0071CE]"
              {...register('consentimiento')}
            />
            <span>
              Acepto que la app use mi <b>ubicación solo al momento de marcar</b> entrada o salida, para
              verificar que estoy en el CD. No se rastrea mi ubicación en otro momento.
            </span>
          </label>
          {formState.errors.consentimiento && (
            <span className="-mt-2 text-xs font-semibold text-[#9B1C10]" role="alert">
              {formState.errors.consentimiento.message}
            </span>
          )}
          {error != null && <ErrorBox error={error} />}
          <Button type="submit" variante="pri" tamano="lg" cargando={formState.isSubmitting}>
            Guardar perfil
          </Button>
          <Button variante="ghost" onClick={() => salir()}>
            Cerrar sesión
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
