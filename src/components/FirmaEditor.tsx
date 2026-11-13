import { useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import { FUENTES_FIRMA, svgFirmaGenerada, type FuenteFirma } from '@/lib/firma';
import { Button, Tabs, cx } from './ui';

export interface FirmaBorrador {
  tipo: 'dibujada' | 'generada';
  svg: string;
  fuente: FuenteFirma | null;
}

interface Props {
  nombre: string;
  onChange: (f: FirmaBorrador | null) => void;
}

export function FirmaEditor({ nombre, onChange }: Props) {
  const [modo, setModo] = useState<'generar' | 'dibujar'>('generar');
  const [fuente, setFuente] = useState<FuenteFirma | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [vacio, setVacio] = useState(true);

  // Firma generada
  useEffect(() => {
    if (modo !== 'generar') return;
    if (fuente && nombre.trim())
      onChange({ tipo: 'generada', fuente, svg: svgFirmaGenerada(nombre, fuente) });
    else onChange(null);
  }, [modo, fuente, nombre, onChange]);

  // Firma dibujada
  useEffect(() => {
    if (modo !== 'dibujar' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ajustar = () => {
      const r = Math.max(window.devicePixelRatio || 1, 1);
      const datos = padRef.current?.toData();
      canvas.width = canvas.offsetWidth * r;
      canvas.height = canvas.offsetHeight * r;
      canvas.getContext('2d')?.scale(r, r);
      padRef.current?.clear();
      if (datos) padRef.current?.fromData(datos);
    };
    const pad = new SignaturePad(canvas, {
      penColor: '#041E42',
      backgroundColor: 'rgba(0,0,0,0)',
      minWidth: 0.8,
      maxWidth: 2.6,
    });
    padRef.current = pad;
    ajustar();
    const fin = () => {
      const v = pad.isEmpty();
      setVacio(v);
      onChange(v ? null : { tipo: 'dibujada', fuente: null, svg: pad.toSVG() });
    };
    pad.addEventListener('endStroke', fin);
    window.addEventListener('resize', ajustar);
    onChange(null);
    setVacio(true);
    return () => {
      pad.removeEventListener('endStroke', fin);
      pad.off();
      window.removeEventListener('resize', ajustar);
      padRef.current = null;
    };
  }, [modo, onChange]);

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        label="Tipo de firma"
        valor={modo}
        onChange={setModo}
        opciones={[
          { valor: 'generar', texto: 'Generar con mi nombre' },
          { valor: 'dibujar', texto: 'Dibujar con el dedo' },
        ]}
      />
      {modo === 'generar' ? (
        <div className="grid gap-2" role="radiogroup" aria-label="Estilo de letra">
          {!nombre.trim() && (
            <p className="text-[13px] text-muted">Escribe tu nombre y apellidos para ver los estilos.</p>
          )}
          {FUENTES_FIRMA.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={fuente === f}
              disabled={!nombre.trim()}
              onClick={() => setFuente(f)}
              className={cx(
                'flex h-[72px] items-center justify-center overflow-hidden rounded-[10px] border-2 bg-white px-3 text-wm-navy disabled:opacity-50',
                fuente === f ? 'border-wm-blue ring-4 ring-wm-blue/20' : 'border-[#E2E7EF]',
              )}
              style={{ fontFamily: `"${f}", cursive`, fontSize: f === 'Dancing Script' ? 28 : 34 }}
            >
              <span className="truncate">{nombre.trim() || 'Tu nombre'}</span>
              <span className="sr-only"> · estilo {f}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="relative overflow-hidden rounded-[10px] border-2 border-dashed border-[#C7D2E2] bg-white">
            <canvas
              ref={canvasRef}
              className="block h-[160px] w-full touch-none"
              aria-label="Área para dibujar tu firma"
            />
            {vacio && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[#8794AA]">
                Firma aquí con el dedo
              </span>
            )}
            <span className="pointer-events-none absolute bottom-8 left-6 right-6 border-b border-[#C7D2E2]" />
          </div>
          <Button
            tamano="sm"
            className="self-start"
            onClick={() => {
              padRef.current?.clear();
              setVacio(true);
              onChange(null);
            }}
          >
            Borrar y repetir
          </Button>
        </div>
      )}
    </div>
  );
}
