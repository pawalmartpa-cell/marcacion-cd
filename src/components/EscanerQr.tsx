import { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { leerQr } from '@/lib/qr';

/** Lee el QR del kiosco con la cámara trasera. */
export function EscanerQr({ cdId, onLeido }: { cdId: string; onLeido: (token: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const listo = useRef(false);

  useEffect(() => {
    let controles: IScannerControls | null = null;
    let cancelado = false;
    const lector = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 250 });
    lector
      .decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        video.current!,
        (res) => {
          if (!res || listo.current) return;
          const q = leerQr(res.getText());
          if (!q) {
            setAviso('Ese código no es de la app de marcación.');
            return;
          }
          if (q.cdId !== cdId) {
            setAviso('Ese QR es de otro centro de distribución.');
            return;
          }
          listo.current = true;
          controles?.stop();
          onLeido(q.token);
        },
      )
      .then((c) => {
        controles = c;
        if (cancelado) c.stop();
      })
      .catch((e: Error) => {
        setError(
          e?.name === 'NotAllowedError'
            ? 'Debes permitir el uso de la cámara para escanear el QR.'
            : 'No se pudo abrir la cámara de este teléfono.',
        );
      });
    return () => {
      cancelado = true;
      controles?.stop();
    };
  }, [cdId, onLeido]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video
          ref={video}
          className="aspect-square w-full object-cover"
          muted
          playsInline
          aria-label="Vista de la cámara"
        />
        <div
          className="pointer-events-none absolute inset-[15%] rounded-2xl border-4 border-wm-yellow/90"
          aria-hidden
        />
      </div>
      {error ? (
        <p className="font-semibold text-bad" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-[13px] text-muted" aria-live="polite">
          {aviso || 'Apunta la cámara al código QR de la pantalla de la garita.'}
        </p>
      )}
    </div>
  );
}
