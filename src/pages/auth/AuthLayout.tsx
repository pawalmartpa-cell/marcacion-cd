import type { ReactNode } from 'react';
import { Logo } from '@/components/Icon';
import { useAuth } from '@/auth/AuthProvider';

export function AuthLayout({ children, ancho = 420 }: { children: ReactNode; ancho?: number }) {
  const { config } = useAuth();
  return (
    <main className="flex min-h-screen items-center justify-center bg-wm-navy p-4 sm:p-5">
      <div
        className="flex w-full flex-col gap-3.5 rounded-[22px] bg-white p-6 text-wm-navy sm:p-[30px]"
        style={{ maxWidth: ancho }}
      >
        <div className="flex items-center gap-2.5">
          <Logo size={44} />
          <div>
            <div className="text-xl font-extrabold">{config.nombreApp}</div>
            <div className="text-[13px] text-[#54627A]">Control de entrada y salida · Seguridad</div>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}

/** Estilos de campo fijos en claro (la tarjeta de acceso siempre es blanca). */
export const inputClaro = 'input !border-[#D5DDE8] !bg-white !text-[#041E42]';
