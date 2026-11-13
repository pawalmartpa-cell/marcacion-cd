import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button, ErrorBox, Field } from '@/components/ui';
import { AuthLayout, inputClaro } from './AuthLayout';
import { GoogleIcon, entrarConGoogle } from './Login';

const esquema = z
  .object({
    email: z.string().trim().email('Escribe un correo válido'),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    password2: z.string(),
  })
  .refine((d) => d.password === d.password2, {
    message: 'Las contraseñas no coinciden',
    path: ['password2'],
  });
type Datos = z.infer<typeof esquema>;

/** Paso 1 del registro con correo. Al crear la cuenta pasa a "Completa tu perfil" (nombre, CD y firma). */
export function Registro() {
  const [error, setError] = useState<unknown>(null);
  const { register, handleSubmit, formState } = useForm<Datos>({ resolver: zodResolver(esquema) });
  const enviar = handleSubmit(async (d) => {
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, d.email, d.password);
      sendEmailVerification(cred.user).catch(() => {});
    } catch (e) {
      setError(e);
    }
  });
  return (
    <AuthLayout>
      <div>
        <h1 className="text-xl">Crear cuenta</h1>
        <p className="text-[13px] text-[#54627A]">Paso 1 de 2 · Después te pedimos nombre, CD y firma.</p>
      </div>
      <form onSubmit={enviar} className="flex flex-col gap-3.5" noValidate>
        <Field label="Correo" error={formState.errors.email?.message}>
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            className={inputClaro}
            {...register('email')}
          />
        </Field>
        <Field label="Contraseña" error={formState.errors.password?.message} ayuda="Mínimo 8 caracteres">
          <input
            type="password"
            autoComplete="new-password"
            className={inputClaro}
            {...register('password')}
          />
        </Field>
        <Field label="Repite la contraseña" error={formState.errors.password2?.message}>
          <input
            type="password"
            autoComplete="new-password"
            className={inputClaro}
            {...register('password2')}
          />
        </Field>
        {error != null && <ErrorBox error={error} />}
        <Button type="submit" variante="pri" tamano="lg" cargando={formState.isSubmitting}>
          Continuar
        </Button>
      </form>
      <Button
        tamano="lg"
        className="!border-[#D5DDE8] !bg-white !text-[#041E42]"
        onClick={() => entrarConGoogle().catch(setError)}
      >
        <GoogleIcon /> Registrarme con Google
      </Button>
      <p className="text-center text-[13px] text-[#54627A]">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-semibold">
          Inicia sesión
        </Link>
      </p>
    </AuthLayout>
  );
}
