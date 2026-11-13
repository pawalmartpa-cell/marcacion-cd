import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './ui';

/** Aviso de nueva versión: el usuario decide cuándo actualizar (así no se corta una marcación). */
export function ActualizacionPwa() {
  const {
    needRefresh: [hayNueva, setHayNueva],
    offlineReady: [listoOffline, setListoOffline],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Revisa si hay versión nueva cada hora.
      if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    },
  });
  if (!hayNueva && !listoOffline) return null;
  return (
    <div
      className="fixed inset-x-3 bottom-3 z-[1050] mx-auto flex max-w-md flex-wrap items-center gap-3 rounded-2xl bg-wm-navy p-4 text-white shadow-2xl sm:inset-x-auto sm:right-5"
      role="status"
    >
      <span className="flex-1 font-semibold">
        {hayNueva ? 'Hay una nueva versión de la app.' : 'La app ya funciona sin conexión.'}
      </span>
      {hayNueva && (
        <Button variante="yellow" tamano="sm" onClick={() => updateServiceWorker(true)}>
          Actualizar
        </Button>
      )}
      <Button
        tamano="sm"
        className="!border-white/30 !bg-transparent !text-white"
        onClick={() => {
          setHayNueva(false);
          setListoOffline(false);
        }}
      >
        Cerrar
      </Button>
    </div>
  );
}
