import { useEffect, useState } from 'react';
import { getCountFromServer } from 'firebase/firestore';
import { useAuth, nombreCompleto } from '@/auth/AuthProvider';
import { col } from '@/data/refs';
import { guardarConfig, hacerAdmin } from '@/data/servicios';
import { fechaCorta } from '@/lib/fechas';
import { Barra, Button, Card, Chip, Dialog, Field, Pill, mensajeError, useToast } from '@/components/ui';
import type { ConfigGeneral } from '@/types';
import { usePanel } from './contexto';
import { Encabezado } from './Panel';

/** Tamaños promedio aproximados por documento (bytes, incluye índices). */
const TAM = { jornadas: 2600, alertas: 900, bitacora: 900, users: 9000, solicitudes: 600, reportes: 500 };
type Coleccion = keyof typeof TAM;

function useUso() {
  const [conteos, setConteos] = useState<Partial<Record<Coleccion, number>>>({});
  const [error, setError] = useState(false);
  useEffect(() => {
    let vivo = true;
    (Object.keys(TAM) as Coleccion[]).forEach((c) =>
      getCountFromServer(col[c]())
        .then((s) => vivo && setConteos((x) => ({ ...x, [c]: s.data().count })))
        .catch(() => vivo && setError(true)),
    );
    return () => {
      vivo = false;
    };
  }, []);
  const bytes = (Object.keys(TAM) as Coleccion[]).reduce((a, c) => a + (conteos[c] ?? 0) * TAM[c], 0);
  return { conteos, bytes, error };
}

export function Configuracion() {
  const { config } = useAuth();
  const { actor, usuarios } = usePanel();
  const toast = useToast();
  const [c, setC] = useState<ConfigGeneral>(config);
  const [guardando, setGuardando] = useState(false);
  const [dlgAdmin, setDlgAdmin] = useState(false);
  const [nuevoAdmin, setNuevoAdmin] = useState('');
  const uso = useUso();
  useEffect(() => setC(config), [config]);
  const admins = usuarios.filter((u) => u.rol === 'admin');
  const candidatos = usuarios.filter((u) => u.rol !== 'admin' && u.estado === 'activo');
  const guardias = usuarios.filter((u) => u.rol === 'seguridad' && u.estado === 'activo').length || 25;

  const guardar = async (nueva: ConfigGeneral, ok = 'Configuración guardada') => {
    setGuardando(true);
    try {
      await guardarConfig(actor, nueva, config);
      toast(ok, 'ok');
    } catch (e) {
      toast(mensajeError(e), 'error');
    } finally {
      setGuardando(false);
    }
  };

  // Estimación diaria (ver docs/estimacion-costos.md).
  const escriturasDia = guardias * 4 * 1.3 + 24 * 3 + 30;
  const lecturasDia = guardias * 60 + 3 * 1500;
  const pctGiB = (uso.bytes / 1024 ** 3) * 100;

  return (
    <>
      <Encabezado titulo="Configuración" sub="Retención de datos, apariencia y administradores" sinFiltro />
      <div className="flex flex-wrap gap-4">
        <Card className="flex flex-[1_1_340px] flex-col gap-3">
          <h2>Retención de datos</h2>
          <span className="text-muted">
            Las marcaciones más antiguas se borran por completo cada noche (tarea automática gratuita en
            GitHub Actions).
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[30, 60, 90, 120, 180].map((d) => (
              <Pill
                key={d}
                activo={c.diasRetencion === d}
                onClick={() => {
                  const n = { ...c, diasRetencion: d };
                  setC(n);
                  guardar(n, `Retención: ${d} días`);
                }}
              >
                {d} días
              </Pill>
            ))}
          </div>
          <b>Se conservan {config.diasRetencion} días · próximo borrado: hoy 23:00</b>
          <div>
            <div className="mb-1.5 text-xs text-muted">Uso del plan gratis de Firestore (almacenamiento)</div>
            <Barra pct={Math.max(pctGiB, 0.5)} label="Uso de almacenamiento" />
            <div className="mt-1 text-xs text-muted">
              {uso.error
                ? 'No se pudo calcular.'
                : `≈ ${(uso.bytes / 1024 ** 2).toFixed(1)} MiB de 1 GiB (${pctGiB.toFixed(2)} %)`}
            </div>
          </div>
          <div className="rounded-xl bg-track p-3 text-xs text-muted">
            <b className="text-text">Uso estimado por día</b> (con {guardias} guardias):
            <br />≈ {Math.round(escriturasDia)} escrituras de 20 000 · ≈{' '}
            {Math.round(lecturasDia).toLocaleString('es-SV')} lecturas de 50 000 · borrados nocturnos ≈{' '}
            {Math.round(escriturasDia)} de 20 000.
            <br />
            Documentos: {uso.conteos.jornadas ?? '…'} jornadas · {uso.conteos.alertas ?? '…'} alertas ·{' '}
            {uso.conteos.bitacora ?? '…'} bitácora · {uso.conteos.users ?? '…'} usuarios.
          </div>
        </Card>
        <Card className="flex flex-[1_1_300px] flex-col gap-3">
          <h2>Apariencia</h2>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['claro', 'Claro'],
                ['oscuro', 'Oscuro'],
                ['auto', 'Automático'],
              ] as const
            ).map(([k, l]) => (
              <Pill key={k} activo={c.tema === k} onClick={() => setC({ ...c, tema: k })}>
                {l}
              </Pill>
            ))}
          </div>
          <Field label="Nombre de la app">
            <input
              className="input"
              maxLength={40}
              value={c.nombreApp}
              onChange={(e) => setC({ ...c, nombreApp: e.target.value })}
            />
          </Field>
          <Field label="Días para volver a cambiar la firma">
            <input
              className="input"
              type="number"
              min={1}
              max={365}
              value={c.diasCambioFirma}
              onChange={(e) =>
                setC({
                  ...c,
                  diasCambioFirma: Math.max(1, Math.min(365, Math.round(Number(e.target.value) || 1))),
                })
              }
            />
          </Field>
          <Button
            variante="pri"
            cargando={guardando}
            disabled={!c.nombreApp.trim()}
            onClick={() => guardar({ ...c, nombreApp: c.nombreApp.trim() })}
          >
            Guardar
          </Button>
        </Card>
        <Card className="flex flex-[1_1_300px] flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h2>Administradores</h2>
            <Button tamano="sm" variante="pri" onClick={() => setDlgAdmin(true)}>
              + Agregar
            </Button>
          </div>
          <span className="text-xs text-muted">Todos tienen el mismo nivel.</span>
          {admins.map((a) => (
            <div
              key={a.uid}
              className="flex items-center justify-between border-b border-line py-2.5 last:border-0"
            >
              <div className="min-w-0">
                <b>{nombreCompleto(a)}</b>
                <div className="truncate text-xs text-muted">
                  {a.email} · desde {fechaCorta(a.creadoEn)}
                </div>
              </div>
              <Chip tono="navy">Admin</Chip>
            </div>
          ))}
        </Card>
      </div>
      <Dialog
        abierto={dlgAdmin}
        onCerrar={() => setDlgAdmin(false)}
        titulo="Agregar administrador"
        acciones={
          <>
            <Button onClick={() => setDlgAdmin(false)}>Cancelar</Button>
            <Button
              variante="pri"
              disabled={!nuevoAdmin}
              onClick={async () => {
                const u = usuarios.find((x) => x.uid === nuevoAdmin);
                if (!u) return;
                try {
                  await hacerAdmin(actor, u);
                  toast(`${nombreCompleto(u)} ahora es administrador`, 'ok');
                  setDlgAdmin(false);
                  setNuevoAdmin('');
                } catch (e) {
                  toast(mensajeError(e), 'error');
                }
              }}
            >
              Agregar
            </Button>
          </>
        }
      >
        <Field
          label="Usuario"
          ayuda="Tendrá el mismo nivel que los demás administradores. Para alguien sin cuenta, créalo en Usuarios con rol Admin."
        >
          <select className="input" value={nuevoAdmin} onChange={(e) => setNuevoAdmin(e.target.value)}>
            <option value="">Elige…</option>
            {candidatos.map((u) => (
              <option key={u.uid} value={u.uid}>
                {nombreCompleto(u)} · {u.rol}
              </option>
            ))}
          </select>
        </Field>
      </Dialog>
    </>
  );
}
