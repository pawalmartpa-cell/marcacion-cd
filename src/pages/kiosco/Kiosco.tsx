import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useAuth, usePerfil } from '@/auth/AuthProvider';
import { ref } from '@/data/refs';
import { useAhora, useDocumento, useEnLinea } from '@/data/hooks';
import { useJornadasKiosco } from '@/data/consultas';
import { publicarLoteKiosco } from '@/data/servicios';
import { contenidoQr, minutosRestantesLote, tokenVigente, type Ventana } from '@/lib/qr';
import { fechaISO, fechaLarga, hora, sumarDiasISO } from '@/lib/fechas';
import { horaEfectiva, metodoTexto } from '@/lib/jornada';
import { Icon, Logo } from '@/components/Icon';
import { Button, Cargando, Vacio, mensajeError } from '@/components/ui';
import type { Cd, KioscoDoc, Marca } from '@/types';

function useWakeLock() {
  const [activo, setActivo] = useState(false);
  useEffect(() => {
    type WL = { release: () => Promise<void>; addEventListener: (e: string, f: () => void) => void };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WL> } };
    if (!nav.wakeLock) return;
    let lock: WL | null = null;
    const pedir = async () => {
      try {
        lock = await nav.wakeLock!.request('screen');
        setActivo(true);
        lock.addEventListener('release', () => setActivo(false));
      } catch {
        setActivo(false);
      }
    };
    const vis = () => {
      if (document.visibilityState === 'visible') pedir();
    };
    pedir();
    document.addEventListener('visibilitychange', vis);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      lock?.release().catch(() => {});
    };
  }, []);
  return activo;
}

function alternarPantallaCompleta() {
  const p = document.fullscreenElement
    ? document.exitFullscreen?.()
    : document.documentElement.requestFullscreen?.();
  p?.catch(() => {});
}

export default function Kiosco() {
  const p = usePerfil();
  const { salir, config } = useAuth();
  const enLinea = useEnLinea();
  const ahora = useAhora(500);
  const wake = useWakeLock();
  const cdDoc = useDocumento<Cd>(ref.cd(p.cdId));
  const kDoc = useDocumento<KioscoDoc>(ref.kiosco(p.cdId));
  const hoy = fechaISO(ahora);
  const jornadas = useJornadasKiosco(p.cdId, sumarDiasISO(hoy, -1));
  const [qrUrl, setQrUrl] = useState('');
  const [errorLote, setErrorLote] = useState('');
  const publicando = useRef(false);
  const cd = cdDoc.datos;
  const rot = cd?.qrRotacionSeg ?? 30;

  const lote = useMemo<Record<string, Ventana>>(() => {
    const t = kDoc.datos?.tokens ?? {};
    return Object.fromEntries(
      Object.entries(t).map(([k, v]) => [k, { desde: v.desde.toMillis(), hasta: v.hasta.toMillis() }]),
    );
  }, [kDoc.datos]);

  // Regenera el lote cuando falta, se va a acabar o cambió la rotación (≈ 24 escrituras al día).
  const restante = minutosRestantesLote(lote, ahora.getTime());
  const necesita =
    !!cd?.qrHabilitado && !kDoc.cargando && (!kDoc.existe || restante < 6 || kDoc.datos?.rotSeg !== rot);
  useEffect(() => {
    if (!necesita || !enLinea || publicando.current) return;
    publicando.current = true;
    publicarLoteKiosco(p.cdId, rot)
      .then(() => setErrorLote(''))
      .catch((e) => setErrorLote(mensajeError(e)))
      .finally(() => {
        setTimeout(() => (publicando.current = false), 10000);
      });
  }, [necesita, enLinea, p.cdId, rot]);

  const vig = tokenVigente(lote, ahora.getTime());
  const token = vig?.token ?? null;
  useEffect(() => {
    if (!token) {
      setQrUrl('');
      return;
    }
    QRCode.toDataURL(contenidoQr(p.cdId, token), {
      width: 720,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#041E42', light: '#FFFFFF' },
    })
      .then(setQrUrl)
      .catch(() => setQrUrl(''));
  }, [token, p.cdId]);

  const marcasHoy = useMemo(() => {
    const out: Array<{ id: string; nombre: string; parte: string; m: Marca; t: Date }> = [];
    for (const j of jornadas.datos) {
      for (const parte of ['entrada', 'salida'] as const) {
        const m = j[parte];
        if (!m) continue;
        const t = horaEfectiva(m);
        if (fechaISO(t) === hoy) out.push({ id: j.id + parte, nombre: j.nombre, parte, m, t });
      }
    }
    return out.sort((a, b) => b.t.getTime() - a.t.getTime());
  }, [jornadas.datos, hoy]);

  const pct = vig ? Math.max(0, ((vig.ventana.hasta - ahora.getTime()) / (rot * 1000)) * 100) : 0;
  const segRest = vig ? Math.ceil((vig.ventana.hasta - ahora.getTime()) / 1000) : 0;

  if (cdDoc.cargando) return <Cargando />;

  return (
    <div className="flex min-h-screen flex-col bg-wm-navy text-white">
      <header className="flex flex-wrap items-center gap-3 px-5 py-4">
        <Logo size={40} />
        <div className="min-w-0 flex-1">
          <div className="text-xl font-extrabold">{cd ? `${cd.nombre} ${cd.codigo}` : p.cdId}</div>
          <div className="text-[13px] text-[#A9B8D3]">
            {config.nombreApp} · {fechaLarga(ahora)}
          </div>
        </div>
        <div className="tabular text-4xl font-extrabold">{hora(ahora)}</div>
        <div className="flex gap-2">
          <Button
            tamano="sm"
            className="!border-white/30 !bg-transparent !text-white"
            onClick={alternarPantallaCompleta}
            aria-label="Pantalla completa"
          >
            <Icon n="pantalla" />
          </Button>
          <Button
            tamano="sm"
            className="!border-white/30 !bg-transparent !text-white"
            onClick={() => salir()}
            aria-label="Cerrar sesión"
          >
            <Icon n="salir" />
          </Button>
        </div>
      </header>

      {!enLinea && (
        <div className="mx-5 rounded-xl bg-[#D93A26] p-3 text-center text-lg font-extrabold" role="alert">
          Sin conexión: el QR no funciona. Los guardias deben marcar con GPS o en la hoja de papel.
        </div>
      )}
      {errorLote && (
        <div className="mx-5 mt-2 rounded-xl bg-[#3D1712] p-3 text-[#FFB4A8]" role="alert">
          No se pudo actualizar el código: {errorLote}
        </div>
      )}

      <main className="grid flex-1 gap-5 p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section
          className="flex flex-col items-center justify-center gap-4 rounded-3xl bg-white p-5 text-wm-navy"
          aria-label="Código QR para marcar"
        >
          {!cd?.qrHabilitado ? (
            <Vacio titulo="El QR está deshabilitado para este CD">
              Un administrador o el PA puede activarlo en “Kiosco QR”.
            </Vacio>
          ) : qrUrl && enLinea ? (
            <>
              <img
                src={qrUrl}
                alt="Código QR vigente para marcar"
                className="aspect-square w-full max-w-[min(70vh,520px)]"
              />
              <div className="w-full max-w-[520px]">
                <div
                  className="h-3 overflow-hidden rounded-full bg-[#EEF2F8]"
                  role="progressbar"
                  aria-valuenow={segRest}
                  aria-valuemin={0}
                  aria-valuemax={rot}
                  aria-label="Tiempo restante del código"
                >
                  <div
                    className="h-3 rounded-full bg-wm-blue transition-[width] duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 text-center text-[15px] font-bold">
                  Escanéalo desde la app · cambia en <span className="tabular">{segRest}</span> s
                </div>
              </div>
            </>
          ) : (
            <Cargando texto="Generando código…" />
          )}
        </section>
        <section
          className="flex min-h-0 flex-col rounded-3xl bg-[#0A2B5C] p-5"
          aria-label="Marcaciones de hoy"
        >
          <h2 className="mb-3 text-lg">Marcaciones de hoy ({marcasHoy.length})</h2>
          {marcasHoy.length === 0 ? (
            <p className="text-[#A9B8D3]">Aún no hay marcaciones hoy.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 overflow-y-auto">
              {marcasHoy.slice(0, 40).map((x) => (
                <li key={x.id} className="flex items-center gap-3 rounded-xl bg-[#12264A] px-3 py-2.5">
                  <span className="tabular w-14 text-lg font-extrabold">{hora(x.t)}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{x.nombre}</span>
                  <span
                    className={
                      'rounded-full px-2.5 py-1 text-xs font-bold ' +
                      (x.parte === 'entrada' ? 'bg-[#103A27] text-[#86E3B0]' : 'bg-[#3A2E0A] text-[#FFD766]')
                    }
                  >
                    {x.parte === 'entrada' ? 'Entrada' : 'Salida'} · {metodoTexto(x.m)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-auto pt-3 text-xs text-[#A9B8D3]">
            {wake
              ? 'Pantalla siempre encendida activada.'
              : 'Mantén este teléfono conectado al cargador y con la pantalla encendida.'}
          </p>
        </section>
      </main>
    </div>
  );
}
