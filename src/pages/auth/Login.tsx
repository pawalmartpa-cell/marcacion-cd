import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInWithEmailAndPassword, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { auth, firebaseConfigurado, googleProvider } from '@/lib/firebase';
import { Button, ErrorBox, Field } from '@/components/ui';
import { AuthLayout, inputClaro } from './AuthLayout';

const esquema = z.object({
  email: z.string().trim().email('Escribe un correo válido'),
  password: z.string().min(1, 'Escribe tu contraseña'),
});
type Datos = z.infer<typeof esquema>;

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

export async function entrarConGoogle() {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    const code = (e as { code?: string }).code;
    // En algunas apps instaladas (PWA) el popup se bloquea: usamos redirección.
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    throw e;
  }
}

export function Login() {
  const [error, setError] = useState<unknown>(null);
  const [cargandoG, setCargandoG] = useState(false);
  const { register, handleSubmit, formState } = useForm<Datos>({ resolver: zodResolver(esquema) });

  const enviar = handleSubmit(async (d) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, d.email, d.password);
    } catch (e) {
      setError(e);
    }
  });

  return (
    <AuthLayout>
      {!firebaseConfigurado && (
        <div className="rounded-xl bg-[#FFF6DB] p-3 text-[13px] font-semibold text-[#5C4300]" role="alert">
          Falta configurar Firebase. Sigue docs/configuracion-firebase.md.
        </div>
      )}
      <Button
        tamano="lg"
        className="!border-[#D5DDE8] !bg-white !text-[#041E42] hover:!bg-[#F4F6FA]"
        cargando={cargandoG}
        onClick={async () => {
          setError(null);
          setCargandoG(true);
          try {
            await entrarConGoogle();
          } catch (e) {
            setError(e);
          } finally {
            setCargandoG(false);
          }
        }}
      >
        <GoogleIcon />
        Continuar con Google
      </Button>
      <div className="flex items-center gap-2.5 text-xs text-[#54627A]">
        <span className="h-px flex-1 bg-[#E2E7EF]" />o con tu correo
        <span className="h-px flex-1 bg-[#E2E7EF]" />
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
        <Field label="Contraseña" error={formState.errors.password?.message}>
          <input
            type="password"
            autoComplete="current-password"
            className={inputClaro}
            {...register('password')}
          />
        </Field>
        {error != null && <ErrorBox error={error} />}
        <Button type="submit" variante="pri" tamano="lg" cargando={formState.isSubmitting}>
          Entrar
        </Button>
      </form>
      <div className="flex flex-col gap-2 text-center text-[13px] text-[#54627A]">
        <Link to="/recuperar" className="font-semibold">
          Olvidé mi contraseña
        </Link>
        <span>
          ¿No tienes cuenta?{' '}
          <Link to="/registro" className="font-semibold">
            Regístrate
          </Link>{' '}
          · tu cuenta queda pendiente hasta que un admin la apruebe.
        </span>
      </div>
    </AuthLayout>
  );
}
