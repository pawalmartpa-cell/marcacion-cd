import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui';
import { AuthLayout } from './AuthLayout';

export function Pendiente() {
  const { perfil, salir } = useAuth();
  return (
    <AuthLayout>
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span
          className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF6DB] text-3xl"
          aria-hidden
        >
          ⏳
        </span>
        <h1 className="text-xl">Esperando aprobación</h1>
        <p className="text-[#54627A]">
          Hola {perfil?.nombre}. Tu cuenta quedó registrada y un administrador debe aprobarla antes de que
          puedas marcar. Esta pantalla se actualiza sola cuando te aprueben.
        </p>
      </div>
      <Button onClick={() => salir()}>Cerrar sesión</Button>
    </AuthLayout>
  );
}

export function Bloqueado() {
  const { salir } = useAuth();
  return (
    <AuthLayout>
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span
          className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FDE7E4] text-3xl"
          aria-hidden
        >
          🔒
        </span>
        <h1 className="text-xl">Cuenta bloqueada</h1>
        <p className="text-[#54627A]">
          Tu cuenta está bloqueada y no puedes entrar ni marcar. Habla con tu coordinador o con un
          administrador.
        </p>
      </div>
      <Button onClick={() => salir()}>Cerrar sesión</Button>
    </AuthLayout>
  );
}
