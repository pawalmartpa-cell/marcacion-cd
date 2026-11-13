import { useCallback, useState } from 'react';
import { useAuth, usePerfil, nombreCompleto } from '@/auth/AuthProvider';
import { cambiarFirma } from '@/data/servicios';
import { diasParaCambiarFirma } from '@/lib/firma';
import { fechaCorta, sumarDiasISO, fechaISO } from '@/lib/fechas';
import { FirmaEditor, type FirmaBorrador } from '@/components/FirmaEditor';
import { FirmaVista } from '@/components/FirmaVista';
import { Button, Card, CardHeader, ErrorBox, useToast } from '@/components/ui';

export function FirmaGuardia() {
  const p = usePerfil();
  const { config } = useAuth();
  const toast = useToast();
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<FirmaBorrador | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const dias = diasParaCambiarFirma(p.firma, config.diasCambioFirma);
  const onChange = useCallback((f: FirmaBorrador | null) => setBorrador(f), []);

  return (
    <>
      <h1>Mi firma</h1>
      <Card className="flex flex-col gap-3">
        <CardHeader titulo="Firma actual" sub="Aparece en los reportes de asistencia junto a tus marcas." />
        <FirmaVista firma={p.firma} alt={`Firma de ${nombreCompleto(p)}`} />
        {p.firma && (
          <p className="text-[13px] text-muted">
            Registrada el {fechaCorta(p.firma.actualizadaEn)} (
            {p.firma.tipo === 'dibujada' ? 'dibujada' : `generada · ${p.firma.fuente}`}).{' '}
            {p.firma.cambioHabilitado
              ? 'Un administrador habilitó el cambio: ya puedes cambiarla.'
              : dias > 0
                ? `Podrás cambiarla a partir del ${fechaCorta(sumarDiasISO(fechaISO(), dias))} (en ${dias} día${dias === 1 ? '' : 's'}).`
                : 'Ya puedes cambiarla.'}
          </p>
        )}
        {!editando && (
          <Button variante="out" disabled={dias > 0} onClick={() => setEditando(true)}>
            Cambiar mi firma
          </Button>
        )}
      </Card>
      {editando && (
        <Card className="flex flex-col gap-3">
          <CardHeader
            titulo="Nueva firma"
            sub={`Después de guardarla no podrás cambiarla por ${config.diasCambioFirma} días. Se avisará a tu coordinador.`}
          />
          <FirmaEditor nombre={nombreCompleto(p)} onChange={onChange} />
          {error != null && <ErrorBox error={error} />}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              variante="pri"
              disabled={!borrador}
              cargando={guardando}
              onClick={async () => {
                if (!borrador) return;
                setGuardando(true);
                setError(null);
                try {
                  await cambiarFirma(p, borrador);
                  toast('Firma actualizada', 'ok');
                  setEditando(false);
                } catch (e) {
                  setError(e);
                } finally {
                  setGuardando(false);
                }
              }}
            >
              Guardar firma
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
