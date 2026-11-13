import { useEffect, useState } from 'react';
import type { Alerta, Jornada, Parte } from '@/types';
import { corregirJornada } from '@/data/servicios';
import {
  duracionTexto,
  fechaCorta,
  fechaISO,
  hora,
  isoADate,
  minutosDeHHMM,
  sumarDiasISO,
} from '@/lib/fechas';
import { detalleMarca, horaEfectiva } from '@/lib/jornada';
import { Button, Dialog, ErrorBox, Field, Pill, cx, useToast } from '@/components/ui';
import { usePanel } from '../contexto';
import { HoraInput } from '@/components/HoraInput';

export const MOTIVOS_RAPIDOS = [
  'Olvidó marcar',
  'Falla de GPS',
  'Sin internet',
  'Verificado con hoja de papel',
];

/** Convierte 'HH:mm' de entrada/salida a fechas reales; la salida pasa al día siguiente si es menor o igual que la entrada. */
export function horasAFechas(
  fecha: string,
  ent: string,
  sal: string,
): { entrada: Date | null; salida: Date | null } {
  const me = minutosDeHHMM(ent);
  const ms = minutosDeHHMM(sal);
  const entrada = me != null ? isoADate(fecha, ent) : null;
  let salida: Date | null = null;
  if (ms != null) salida = isoADate(me != null && ms <= me ? sumarDiasISO(fecha, 1) : fecha, sal);
  return { entrada, salida };
}

export function EditarJornada({
  jornada,
  foco,
  onCerrar,
}: {
  jornada: Jornada | null;
  foco: Parte;
  onCerrar: () => void;
}) {
  const { actor, cdNombre, alertasAbiertas } = usePanel();
  const toast = useToast();
  const [ent, setEnt] = useState('');
  const [sal, setSal] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!jornada) return;
    setEnt(hora(horaEfectiva(jornada.entrada)));
    setSal(jornada.salida ? hora(horaEfectiva(jornada.salida)) : '');
    setMotivo('');
    setError(null);
  }, [jornada]);

  if (!jornada) return null;
  const j = jornada;
  const { entrada, salida } = horasAFechas(j.fecha, ent, sal);
  const min = entrada && salida ? Math.round((salida.getTime() - entrada.getTime()) / 60000) : null;
  const alertasJ: Alerta[] = alertasAbiertas.filter((a) => a.jornadaId === j.id);

  async function guardar() {
    if (!motivo.trim() || motivo.trim().length < 3) {
      toast('Escribe el motivo antes de guardar', 'error');
      document.getElementById('motivo-jornada')?.focus();
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const cambios = await corregirJornada(actor, j, {
        entrada,
        salida,
        motivo: motivo.trim(),
        alertasAbiertas: alertasJ,
      });
      if (!cambios.length) {
        toast('No cambiaste ninguna hora');
        return;
      }
      toast('Jornada corregida y registrada en la bitácora', 'ok');
      onCerrar();
    } catch (e) {
      setError(e);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog
      abierto
      onCerrar={onCerrar}
      titulo="Corregir jornada"
      acciones={
        <>
          <Button onClick={onCerrar}>Cancelar</Button>
          <Button variante="pri" onClick={guardar} cargando={guardando}>
            Guardar jornada
          </Button>
        </>
      }
    >
      <div className="-mt-2 text-muted">
        {j.nombre} · {cdNombre(j.cdId)} · {fechaCorta(j.fecha)} · turno {j.turno.nombre.toLowerCase()}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div
          className={cx(
            'flex flex-col gap-2 rounded-xl border p-3',
            foco === 'entrada' ? 'border-wm-blue ring-[3px] ring-wm-blue/20' : 'border-line',
          )}
        >
          <b>Entrada</b>
          <HoraInput
            value={ent}
            onChange={setEnt}
            aria-label="Hora de entrada"
            data-autofocus={foco === 'entrada' ? '' : undefined}
            className="h-[46px] w-full rounded-[10px] border border-line bg-card px-2.5 text-xl font-bold"
          />
          <span className="text-xs text-muted">
            Original: {hora(horaEfectiva(j.entradaOriginal ?? j.entrada))} ·{' '}
            {detalleMarca(j.entradaOriginal ?? j.entrada)}
          </span>
        </div>
        <div
          className={cx(
            'flex flex-col gap-2 rounded-xl border p-3',
            foco === 'salida' ? 'border-wm-blue ring-[3px] ring-wm-blue/20' : 'border-line',
          )}
        >
          <b>Salida</b>
          <HoraInput
            value={sal}
            onChange={setSal}
            aria-label="Hora de salida"
            data-autofocus={foco === 'salida' ? '' : undefined}
            className="h-[46px] w-full rounded-[10px] border border-line bg-card px-2.5 text-xl font-bold"
          />
          <span className="text-xs text-muted">
            {(j.salidaOriginal ?? j.salida)
              ? `Original: ${hora(horaEfectiva((j.salidaOriginal ?? j.salida)!))} · ${detalleMarca((j.salidaOriginal ?? j.salida)!)}`
              : 'No marcó salida'}
          </span>
        </div>
      </div>
      <div className="text-[13px] text-muted">
        Horas de la jornada:{' '}
        <b className="text-text tabular">{min != null && min >= 0 ? duracionTexto(min) : '—'}</b>
        {salida && entrada && fechaISO(salida) !== fechaISO(entrada) && (
          <span> · la salida queda el día siguiente</span>
        )}
      </div>
      <Field label="Motivo (obligatorio)">
        <textarea
          id="motivo-jornada"
          rows={3}
          className="input"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej.: olvidó marcar salida, verificado con hoja de papel"
        />
      </Field>
      <div className="flex flex-wrap gap-1.5" aria-label="Motivos rápidos">
        {MOTIVOS_RAPIDOS.map((m) => (
          <Pill key={m} onClick={() => setMotivo((v) => (v ? `${v}. ${m}` : m))}>
            {m}
          </Pill>
        ))}
      </div>
      {alertasJ.length > 0 && (
        <p className="text-xs text-muted">
          Al guardar se cerrarán {alertasJ.length} alerta(s) abierta(s) de esta jornada.
        </p>
      )}
      {error != null && <ErrorBox error={error} />}
    </Dialog>
  );
}
