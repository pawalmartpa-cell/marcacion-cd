import { useState } from 'react';
import { useAuth, usePerfil, nombreCompleto } from '@/auth/AuthProvider';
import { actualizarNombre } from '@/data/servicios';
import { Avatar, Button, Card, CardHeader, Field, mensajeError, useToast } from '@/components/ui';
import { SelectorTema } from '@/pages/guardia/PerfilGuardia';
import { ROL_TEXTO } from '@/types';
import { usePanel } from './contexto';
import { Encabezado } from './Panel';

export function PerfilPanel() {
  const p = usePerfil();
  const { salir } = useAuth();
  const { cdNombre, esAdmin } = usePanel();
  const toast = useToast();
  const [nombre, setNombre] = useState(p.nombre);
  const [apellidos, setApellidos] = useState(p.apellidos);
  const [guardando, setGuardando] = useState(false);
  return (
    <>
      <Encabezado
        titulo="Mi perfil"
        sub={`${ROL_TEXTO[p.rol]} · ${esAdmin ? 'Todos los CD' : cdNombre(p.cdId)}`}
        sinFiltro
      />
      <Card className="flex max-w-[560px] flex-col gap-3.5">
        <div className="flex items-center gap-3.5">
          <Avatar nombre={p.nombre} apellidos={p.apellidos} grande />
          <div>
            <b className="text-lg">{nombreCompleto(p)}</b>
            <div className="text-muted">
              {p.email} · Acceso con {p.proveedor === 'google' ? 'Google' : 'correo'}
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre">
            <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Field>
          <Field label="Apellidos">
            <input className="input" value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <Button
            variante="pri"
            cargando={guardando}
            disabled={!nombre.trim() || !apellidos.trim()}
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
          <Button variante="danger" onClick={() => salir()}>
            Cerrar sesión
          </Button>
        </div>
      </Card>
      <Card className="mt-4 flex max-w-[560px] flex-col gap-2.5">
        <CardHeader titulo="Apariencia en este dispositivo" />
        <SelectorTema />
      </Card>
      <p className="mt-4 text-xs text-muted">Versión {__APP_VERSION__}</p>
    </>
  );
}
