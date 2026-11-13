import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { usePerfil } from '@/auth/AuthProvider';
import { useJornadasDeGuardia, useSolicitudes } from '@/data/consultas';
import { crearSolicitud } from '@/data/servicios';
import { fechaCorta, fechaHora, fechaISO, hora, sumarDiasISO } from '@/lib/fechas';
import { horaEfectiva } from '@/lib/jornada';
import { Button, Card, CardHeader, Cargando, Chip, ErrorBox, Field, Vacio, useToast } from '@/components/ui';
import type { Solicitud } from '@/types';

export const TIPO_SOLICITUD: Record<Solicitud['tipo'], string> = {
  olvido_entrada: 'Olvidé marcar la entrada',
  olvido_salida: 'Olvidé marcar la salida',
  hora_incorrecta: 'La hora quedó mal',
  otro: 'Otro',
};
export const ESTADO_SOLICITUD: Record<Solicitud['estado'], { texto: string; tono: 'warn' | 'ok' | 'bad' }> = {
  abierta: { texto: 'En revisión', tono: 'warn' },
  resuelta: { texto: 'Resuelta', tono: 'ok' },
  rechazada: { texto: 'Rechazada', tono: 'bad' },
};

const esquema = z.object({
  jornadaId: z.string(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige la fecha'),
  tipo: z.enum(['olvido_entrada', 'olvido_salida', 'hora_incorrecta', 'otro']),
  texto: z.string().trim().min(3, 'Cuenta qué pasó').max(500),
});
type Datos = z.infer<typeof esquema>;

export function SolicitudesGuardia() {
  const p = usePerfil();
  const toast = useToast();
  const [params] = useSearchParams();
  const hoy = fechaISO();
  const jornadas = useJornadasDeGuardia(p.uid, sumarDiasISO(hoy, -31));
  const sols = useSolicitudes({ uid: p.uid });
  const [error, setError] = useState<unknown>(null);
  const inicial = params.get('jornada') ?? '';
  const jIni = jornadas.datos.find((j) => j.id === inicial);
  const { register, handleSubmit, formState, reset, setValue, watch } = useForm<Datos>({
    resolver: zodResolver(esquema),
    values: {
      jornadaId: inicial,
      fecha: jIni?.fecha ?? hoy,
      tipo: jIni && !jIni.salida ? 'olvido_salida' : 'olvido_entrada',
      texto: '',
    },
  });
  const jornadaId = watch('jornadaId');

  const enviar = handleSubmit(async (d) => {
    setError(null);
    try {
      await crearSolicitud(p, {
        jornadaId: d.jornadaId || null,
        fecha: d.fecha,
        tipo: d.tipo,
        texto: d.texto,
      });
      toast('Solicitud enviada al administrador', 'ok');
      reset({ jornadaId: '', fecha: hoy, tipo: 'olvido_entrada', texto: '' });
    } catch (e) {
      setError(e);
    }
  });

  return (
    <>
      <h1>Solicitar corrección</h1>
      <Card>
        <form className="flex flex-col gap-3.5" onSubmit={enviar} noValidate>
          <Field label="Jornada" ayuda="Si olvidaste marcar la entrada, elige “Otra fecha”.">
            <select
              className="input"
              {...register('jornadaId', {
                onChange: (e) => {
                  const j = jornadas.datos.find((x) => x.id === e.target.value);
                  if (j) setValue('fecha', j.fecha);
                },
              })}
            >
              <option value="">Otra fecha (sin jornada)</option>
              {jornadas.datos.map((j) => (
                <option key={j.id} value={j.id}>
                  {fechaCorta(j.fecha)} · {j.turno.nombre} · {hora(horaEfectiva(j.entrada))} →{' '}
                  {j.salida ? hora(horaEfectiva(j.salida)) : 'sin salida'}
                </option>
              ))}
            </select>
          </Field>
          {!jornadaId && (
            <Field label="Fecha" error={formState.errors.fecha?.message}>
              <input
                type="date"
                className="input"
                max={hoy}
                min={sumarDiasISO(hoy, -31)}
                {...register('fecha')}
              />
            </Field>
          )}
          <Field label="¿Qué pasó?">
            <select className="input" {...register('tipo')}>
              {Object.entries(TIPO_SOLICITUD).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Explica (con la hora real)" error={formState.errors.texto?.message}>
            <textarea
              rows={3}
              className="input"
              placeholder="Ej.: salí a las 22:00 pero el teléfono se quedó sin batería"
              {...register('texto')}
            />
          </Field>
          {error != null && <ErrorBox error={error} />}
          <Button type="submit" variante="pri" tamano="lg" cargando={formState.isSubmitting}>
            Enviar solicitud
          </Button>
        </form>
      </Card>
      <Card>
        <CardHeader titulo="Mis solicitudes" />
        {sols.cargando ? (
          <Cargando />
        ) : sols.error ? (
          <ErrorBox error={sols.error} />
        ) : sols.datos.length === 0 ? (
          <Vacio titulo="No has enviado solicitudes" />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {sols.datos.map((s) => (
              <li key={s.id} className="flex flex-col gap-1 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b>
                    {fechaCorta(s.fecha)} · {TIPO_SOLICITUD[s.tipo]}
                  </b>
                  <Chip tono={ESTADO_SOLICITUD[s.estado].tono}>{ESTADO_SOLICITUD[s.estado].texto}</Chip>
                </div>
                <span className="text-[13px] text-muted">{s.texto}</span>
                {s.respuesta && <span className="text-[13px]">Respuesta: {s.respuesta}</span>}
                <span className="text-xs text-muted">Enviada {fechaHora(s.creadoEn)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
