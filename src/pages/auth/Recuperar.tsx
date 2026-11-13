import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button, ErrorBox, Field } from '@/components/ui';
import { AuthLayout, inputClaro } from './AuthLayout';

const esquema = z.object({ email: z.string().trim().email('Escribe un correo válido') });

export function Recuperar() {
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const { register, handleSubmit, formState } = useForm<{ email: string }>({
    resolver: zodResolver(esquema),
  });
  return (
    <AuthLayout>
      <h1 className="text-xl">Recuperar contraseña</h1>
      {enviado ? (
        <p className="rounded-xl bg-[#E7F7EE] p-3 font-semibold text-[#0B6B3A]" role="status">
          Si el correo tiene cuenta, te llegará un enlace para crear una nueva contraseña. Revisa también la
          carpeta de spam.
        </p>
      ) : (
        <form
          className="flex flex-col gap-3.5"
          noValidate
          onSubmit={handleSubmit(async (d) => {
            setError(null);
            try {
              await sendPasswordResetEmail(auth, d.email);
              setEnviado(true);
            } catch (e) {
              if ((e as { code?: string }).code === 'auth/user-not-found') setEnviado(true);
              else setError(e);
            }
          })}
        >
          <Field label="Correo" error={formState.errors.email?.message}>
            <input type="email" autoComplete="email" className={inputClaro} {...register('email')} />
          </Field>
          {error != null && <ErrorBox error={error} />}
          <Button type="submit" variante="pri" tamano="lg" cargando={formState.isSubmitting}>
            Enviar enlace
          </Button>
        </form>
      )}
      <Link to="/login" className="text-center text-[13px] font-semibold">
        Volver a iniciar sesión
      </Link>
    </AuthLayout>
  );
}
