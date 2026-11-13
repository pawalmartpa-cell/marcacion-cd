import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, nombreCompleto } from '@/auth/AuthProvider';
import { habilitarCambioFirma } from '@/data/servicios';
import { fechaCorta } from '@/lib/fechas';
import { FirmaVista } from '@/components/FirmaVista';
import { Button, Card, Vacio, mensajeError, useToast } from '@/components/ui';
import { usePanel } from './contexto';
import { Encabezado } from './Panel';

export function Firmas() {
  const { usuarios, esAdmin, actor, r, cdNombre } = usePanel();
  const { config } = useAuth();
  const toast = useToast();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const lista = usuarios.filter((u) => u.firma);
  return (
    <>
      <Encabezado
        titulo="Firmas"
        sub={`Solo lectura. ${esAdmin ? 'El admin' : 'Un administrador'} puede habilitar un cambio antes de los ${config.diasCambioFirma} días.`}
      />
      {lista.length === 0 ? (
        <Card>
          <Vacio titulo="Aún no hay firmas registradas" />
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
          {lista.map((u) => (
            <Card key={u.uid} className="flex flex-col gap-2.5">
              <FirmaVista firma={u.firma} alt={`Firma de ${nombreCompleto(u)}`} />
              <div className="flex justify-between gap-2">
                <Link to={r(`guardia/${u.uid}`)} className="font-bold no-underline">
                  {nombreCompleto(u)}
                </Link>
                <span className="text-right text-muted">{cdNombre(u.cdId)}</span>
              </div>
              <span className="text-xs text-muted">
                {u.firma!.cambioHabilitado
                  ? 'Cambio habilitado · el usuario fue notificado'
                  : `Firmada el ${fechaCorta(u.firma!.actualizadaEn)} · bloqueada por ${config.diasCambioFirma} días`}
              </span>
              {esAdmin &&
                (u.firma!.cambioHabilitado ? (
                  <Button tamano="sm" disabled>
                    Cambio habilitado
                  </Button>
                ) : (
                  <Button
                    tamano="sm"
                    variante="out"
                    disabled={ocupado === u.uid}
                    onClick={async () => {
                      setOcupado(u.uid);
                      try {
                        await habilitarCambioFirma(actor, u);
                        toast(`Se notificó a ${nombreCompleto(u)} que puede cambiar su firma`, 'ok');
                      } catch (e) {
                        toast(mensajeError(e), 'error');
                      } finally {
                        setOcupado(null);
                      }
                    }}
                  >
                    Habilitar cambio ahora
                  </Button>
                ))}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
