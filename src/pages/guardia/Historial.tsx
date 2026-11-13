import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, usePerfil } from '@/auth/AuthProvider';
import { useJornadasDeGuardia } from '@/data/consultas';
import { fechaCorta, fechaISO, mesAnio, sumarDiasISO } from '@/lib/fechas';
import { CalendarioMes, resumenMes } from '@/components/CalendarioMes';
import { Button, Card, CardHeader, Cargando, ErrorBox, Vacio } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { JornadaFila } from './Inicio';

export function Historial() {
  const p = usePerfil();
  const { config } = useAuth();
  const hoy = fechaISO();
  const limite = sumarDiasISO(hoy, -config.diasRetencion);
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)));
  const [mes, setMes] = useState(Number(hoy.slice(5, 7)));
  const [dia, setDia] = useState<string | null>(null);
  const { datos, cargando, error } = useJornadasDeGuardia(p.uid, limite);

  const mover = (d: number) => {
    let m = mes + d;
    let a = anio;
    if (m < 1) {
      m = 12;
      a--;
    }
    if (m > 12) {
      m = 1;
      a++;
    }
    setMes(m);
    setAnio(a);
    setDia(null);
  };
  const prefMes = `${anio}-${String(mes).padStart(2, '0')}`;
  const puedeAtras = `${prefMes}-01` > limite;
  const puedeAdelante = prefMes < hoy.slice(0, 7);
  const r = resumenMes(datos, anio, mes);
  const lista = datos.filter((j) => (dia ? j.fecha === dia : j.fecha.startsWith(prefMes)));

  return (
    <>
      <h1>Mi historial</h1>
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <Button tamano="sm" onClick={() => mover(-1)} disabled={!puedeAtras} aria-label="Mes anterior">
            <Icon n="atras" />
          </Button>
          <h2>{mesAnio(anio, mes)}</h2>
          <Button tamano="sm" onClick={() => mover(1)} disabled={!puedeAdelante} aria-label="Mes siguiente">
            <Icon n="atras" className="rotate-180" />
          </Button>
        </div>
        {cargando ? <Cargando /> : <CalendarioMes anio={anio} mes={mes} jornadas={datos} onDia={setDia} />}
        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-track p-3">
            <div className="text-xs text-muted">Días trabajados</div>
            <div className="text-[22px] font-extrabold tabular">{r.dias}</div>
          </div>
          <div className="rounded-xl bg-track p-3">
            <div className="text-xs text-muted">Tardanzas / sin salida</div>
            <div className="text-[22px] font-extrabold tabular">{r.tardanzas}</div>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader
          titulo={dia ? `Jornadas del ${fechaCorta(dia)}` : 'Jornadas del mes'}
          sub={`Se guardan los últimos ${config.diasRetencion} días`}
          accion={
            dia ? (
              <Button tamano="sm" variante="ghost" onClick={() => setDia(null)}>
                Ver todo el mes
              </Button>
            ) : undefined
          }
        />
        {error ? (
          <ErrorBox error={error} />
        ) : lista.length === 0 ? (
          <Vacio titulo="Sin jornadas en este periodo" />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {lista.map((j) => (
              <JornadaFila
                key={j.id}
                j={j}
                accion={
                  <Link to={`/app/solicitudes?jornada=${j.id}`} className="text-xs font-bold">
                    Pedir corrección
                  </Link>
                }
              />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
