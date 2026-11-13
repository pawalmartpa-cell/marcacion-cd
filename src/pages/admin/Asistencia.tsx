import { useState } from 'react';
import { useAlertas, useJornadas } from '@/data/consultas';
import { fechaISO, lunesDeISO, sumarDiasISO } from '@/lib/fechas';
import { ESTADO_MARCA, estadoJornada, resolucionesDe } from '@/lib/jornada';
import { Card, Cargando, ErrorBox, Leyenda, Pill, Tabs } from '@/components/ui';
import type { Jornada, Parte } from '@/types';
import { usePanel } from './contexto';
import { Encabezado } from './Panel';
import { TablaJornadas } from './comp/TablaJornadas';
import { EditarJornada } from './comp/EditarJornada';

type Rango = 'hoy' | 'ayer' | 'semana' | 'rango';

export const LEYENDA_ZONAS = [
  { color: ESTADO_MARCA.ok.color, texto: 'Dentro del radio', redondo: true },
  { color: ESTADO_MARCA.obs.color, texto: 'Observación (150 m – 1 km)', redondo: true },
  { color: ESTADO_MARCA.alerta.color, texto: 'Fuera de 1 km', redondo: true },
  { color: ESTADO_MARCA.sync.color, texto: 'Sin conexión', redondo: true },
];

export function Asistencia() {
  const { alcance, esAdmin } = usePanel();
  const hoy = fechaISO();
  const [rango, setRango] = useState<Rango>('hoy');
  const [desdeR, setDesdeR] = useState(sumarDiasISO(hoy, -14));
  const [hastaR, setHastaR] = useState(hoy);
  const [q, setQ] = useState('');
  const [soloPend, setSoloPend] = useState(false);
  const [editando, setEditando] = useState<{ j: Jornada; foco: Parte } | null>(null);

  const [desde, hasta] =
    rango === 'hoy'
      ? [hoy, hoy]
      : rango === 'ayer'
        ? [sumarDiasISO(hoy, -1), sumarDiasISO(hoy, -1)]
        : rango === 'semana'
          ? [lunesDeISO(hoy), hoy]
          : [desdeR <= hastaR ? desdeR : hastaR, hastaR >= desdeR ? hastaR : desdeR];
  const jornadas = useJornadas(alcance, desde, hasta);
  const alertas = useAlertas(alcance, { max: 400 });

  let filas = jornadas.datos;
  if (q.trim()) filas = filas.filter((j) => j.nombre.toLowerCase().includes(q.trim().toLowerCase()));
  const conPend = filas.filter((j) => estadoJornada(j, resolucionesDe(alertas.datos, j.id)).pendiente);
  if (soloPend) filas = conPend;

  return (
    <>
      <Encabezado
        titulo="Registros de asistencia"
        sub={
          esAdmin
            ? 'Una fila por jornada: entrada y salida juntas. Toca una hora para corregirla.'
            : 'Una fila por jornada: entrada y salida juntas.'
        }
      />
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <Tabs
            label="Periodo"
            valor={rango}
            onChange={setRango}
            opciones={[
              { valor: 'hoy', texto: 'Hoy' },
              { valor: 'ayer', texto: 'Ayer' },
              { valor: 'semana', texto: 'Esta semana' },
              { valor: 'rango', texto: 'Rango' },
            ]}
          />
          {rango === 'rango' && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                className="input !h-10 !w-auto"
                value={desdeR}
                max={hoy}
                onChange={(e) => setDesdeR(e.target.value)}
                aria-label="Desde"
              />
              <span className="text-muted">a</span>
              <input
                type="date"
                className="input !h-10 !w-auto"
                value={hastaR}
                max={hoy}
                onChange={(e) => setHastaR(e.target.value)}
                aria-label="Hasta"
              />
            </div>
          )}
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar guardia"
            aria-label="Buscar guardia"
            className="input !h-10 !w-[200px]"
          />
          <Pill activo={soloPend} onClick={() => setSoloPend((v) => !v)}>
            Solo con pendientes ({conPend.length})
          </Pill>
          <span className="flex-1" />
          {esAdmin ? (
            <span className="text-xs text-muted">Toda corrección pide motivo y queda en la bitácora</span>
          ) : (
            <span className="text-xs text-muted">Solo lectura: las horas las corrige un administrador</span>
          )}
        </div>
        <div className="mb-2.5">
          <Leyenda items={LEYENDA_ZONAS} />
        </div>
        {jornadas.error ? (
          <ErrorBox error={jornadas.error} />
        ) : jornadas.cargando ? (
          <Cargando />
        ) : (
          <TablaJornadas
            jornadas={filas}
            alertas={alertas.datos}
            onEditar={esAdmin ? (j, foco) => setEditando({ j, foco }) : undefined}
          />
        )}
      </Card>
      <EditarJornada
        jornada={editando?.j ?? null}
        foco={editando?.foco ?? 'entrada'}
        onCerrar={() => setEditando(null)}
      />
    </>
  );
}
