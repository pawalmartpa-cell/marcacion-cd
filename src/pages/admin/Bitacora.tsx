import { useMemo, useState } from 'react';
import { useBitacora } from '@/data/consultas';
import { fechaHora, fechaISO, isoADate, sumarDiasISO } from '@/lib/fechas';
import { Card, Cargando, ErrorBox, Field, Vacio } from '@/components/ui';
import { usePanel } from './contexto';
import { Encabezado } from './Panel';

export const ACCIONES: Record<string, string> = {
  corregir_jornada: 'Corrigió jornada',
  crear_jornada: 'Agregó jornada',
  aceptar_alerta: 'Aceptó alerta',
  rechazar_alerta: 'Rechazó alerta',
  aprobar_usuario: 'Aprobó usuario',
  rechazar_usuario: 'Rechazó registro',
  bloquear_usuario: 'Bloqueó usuario',
  desbloquear_usuario: 'Desbloqueó usuario',
  editar_usuario: 'Editó usuario',
  eliminar_usuario: 'Eliminó usuario',
  invitar_usuario: 'Invitó usuario',
  borrar_invitacion: 'Canceló invitación',
  habilitar_firma: 'Habilitó cambio de firma',
  aprobar_dispositivo: 'Aprobó teléfono',
  nombrar_admin: 'Nombró administrador',
  crear_cd: 'Agregó CD',
  editar_cd: 'Editó CD',
  configurar_qr: 'Configuró QR',
  configuracion: 'Cambió configuración',
  resolver_solicitud: 'Resolvió solicitud',
  rechazar_solicitud: 'Rechazó solicitud',
  generar_reporte: 'Generó reporte',
  purga: 'Limpieza automática',
};

export function Bitacora() {
  const { esAdmin, actor } = usePanel();
  const hoy = fechaISO();
  const [desde, setDesde] = useState(sumarDiasISO(hoy, -7));
  const [hasta, setHasta] = useState(hoy);
  const [quien, setQuien] = useState('');
  const [accion, setAccion] = useState('');
  const [q, setQ] = useState('');
  const d1 = useMemo(() => isoADate(desde <= hasta ? desde : hasta), [desde, hasta]);
  const d2 = useMemo(() => isoADate(sumarDiasISO(hasta >= desde ? hasta : desde, 1)), [desde, hasta]);
  const { datos, cargando, error } = useBitacora(esAdmin ? null : actor.cdId, d1, d2);
  const personas = [...new Map(datos.map((b) => [b.quien, b.quienNombre])).entries()];
  const acciones = [...new Set(datos.map((b) => b.accion))];
  const lista = datos.filter(
    (b) =>
      (!quien || b.quien === quien) &&
      (!accion || b.accion === accion) &&
      (!q.trim() || `${b.detalle} ${b.motivo ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())),
  );
  return (
    <>
      <Encabezado
        titulo="Bitácora"
        sub="Todo cambio hecho por un admin o PA queda registrado. No se puede editar ni borrar."
        sinFiltro
      />
      <Card className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Desde">
          <input
            type="date"
            className="input"
            value={desde}
            max={hoy}
            onChange={(e) => setDesde(e.target.value)}
          />
        </Field>
        <Field label="Hasta">
          <input
            type="date"
            className="input"
            value={hasta}
            max={hoy}
            onChange={(e) => setHasta(e.target.value)}
          />
        </Field>
        <Field label="Usuario">
          <select className="input" value={quien} onChange={(e) => setQuien(e.target.value)}>
            <option value="">Todos</option>
            {personas.map(([id, n]) => (
              <option key={id} value={id}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Acción">
          <select className="input" value={accion} onChange={(e) => setAccion(e.target.value)}>
            <option value="">Todas</option>
            {acciones.map((a) => (
              <option key={a} value={a}>
                {ACCIONES[a] ?? a}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Buscar">
          <input
            type="search"
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre, motivo…"
          />
        </Field>
      </Card>
      <Card>
        {error ? (
          <ErrorBox error={error} />
        ) : cargando ? (
          <Cargando />
        ) : lista.length === 0 ? (
          <Vacio titulo="Sin registros con esos filtros" />
        ) : (
          <ol>
            {lista.map((b) => (
              <li key={b.id} className="flex gap-4 border-b border-line px-1 py-3 last:border-0">
                <span className="tabular w-[120px] shrink-0 text-muted">{fechaHora(b.fecha)}</span>
                <div className="min-w-0">
                  <b className="break-words">{b.detalle}</b>
                  {b.motivo && <div className="text-[13px]">Motivo: {b.motivo}</div>}
                  <div className="text-xs text-muted">
                    {b.quienNombre} ({b.rol === 'pa' ? 'PA' : b.rol === 'admin' ? 'Admin' : b.rol}) ·{' '}
                    {ACCIONES[b.accion] ?? b.accion}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
        {datos.length >= 500 && (
          <p className="mt-2 text-xs text-muted">
            Se muestran los 500 registros más recientes del rango. Acorta el rango para ver más.
          </p>
        )}
      </Card>
    </>
  );
}
