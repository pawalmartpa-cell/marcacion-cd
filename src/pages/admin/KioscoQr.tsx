import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { nombreCompleto } from '@/auth/AuthProvider';
import { ref } from '@/data/refs';
import { useDocumento } from '@/data/hooks';
import { configurarQr } from '@/data/servicios';
import { contenidoQr } from '@/lib/qr';
import { haceTexto } from '@/lib/fechas';
import { Card, Cargando, LinkButton, Pill, Switch, Vacio, mensajeError, useToast } from '@/components/ui';
import type { Cd, KioscoDoc } from '@/types';
import { usePanel } from './contexto';
import { Encabezado } from './Panel';

function QrEjemplo({ cdId, activo }: { cdId: string; activo: boolean }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    QRCode.toDataURL(contenidoQr(cdId, 'EJEMPLONOVALIDO'), {
      width: 300,
      margin: 1,
      color: { dark: '#041E42', light: '#FFFFFF' },
    }).then(setUrl);
  }, [cdId]);
  return url ? (
    <img
      src={url}
      alt="Ejemplo de código QR (no sirve para marcar)"
      className="h-[150px] w-[150px] rounded-lg"
      style={{ opacity: activo ? 1 : 0.3 }}
    />
  ) : null;
}

function TarjetaKiosco({ c }: { c: Cd }) {
  const { actor, esAdmin, usuarios, r } = usePanel();
  const toast = useToast();
  const k = useDocumento<KioscoDoc>(ref.kiosco(c.id));
  const [ocupado, setOcupado] = useState(false);
  const cuentas = usuarios.filter((u) => u.rol === 'kiosco' && u.cdId === c.id);
  const cambiar = async (cambios: { qrHabilitado?: boolean; qrRotacionSeg?: number }, ok: string) => {
    setOcupado(true);
    try {
      await configurarQr(actor, c, cambios);
      toast(ok, 'ok');
    } catch (e) {
      toast(mensajeError(e), 'error');
    } finally {
      setOcupado(false);
    }
  };
  const minutos = k.datos?.actualizadoEn ? (Date.now() - k.datos.actualizadoEn.toMillis()) / 60000 : null;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <b className="text-base">
          {c.nombre} {c.codigo}
        </b>
        <Switch
          activo={c.qrHabilitado}
          label={`Habilitar QR en ${c.nombre}`}
          disabled={ocupado}
          onChange={(v) =>
            cambiar({ qrHabilitado: v }, `QR ${v ? 'habilitado' : 'deshabilitado'} en ${c.nombre}`)
          }
        />
      </div>
      <div className="flex justify-center p-2">
        <QrEjemplo cdId={c.id} activo={c.qrHabilitado} />
      </div>
      <span className="text-center text-[13px] text-muted">
        {c.qrHabilitado ? 'Habilitado · el kiosco muestra el código' : 'Deshabilitado · solo GPS'}
        {c.qrHabilitado && (
          <>
            <br />
            {minutos == null
              ? 'El kiosco aún no se ha conectado.'
              : minutos < 70
                ? `Kiosco activo · código actualizado ${haceTexto(k.datos!.actualizadoEn)}`
                : `⚠ El kiosco no actualiza el código desde ${haceTexto(k.datos!.actualizadoEn)}`}
          </>
        )}
      </span>
      <div>
        <div className="mb-1.5 text-xs font-semibold text-muted">El código cambia cada</div>
        <div className="flex flex-wrap gap-1.5">
          {[15, 30, 60].map((s) => (
            <Pill
              key={s}
              activo={c.qrRotacionSeg === s}
              onClick={
                esAdmin && !ocupado
                  ? () => cambiar({ qrRotacionSeg: s }, `El QR de ${c.nombre} cambiará cada ${s} s`)
                  : undefined
              }
              className={!esAdmin ? 'cursor-default' : undefined}
            >
              {s} s
            </Pill>
          ))}
        </div>
        {!esAdmin && <div className="mt-1 text-xs text-muted">Solo un administrador cambia la rotación.</div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5 text-[13px]">
        <span>Cuenta kiosco</span>
        {cuentas.length ? (
          <b>{cuentas.map((u) => `${nombreCompleto(u)} (${u.email})`).join(', ')}</b>
        ) : esAdmin ? (
          <LinkButton tamano="sm" variante="ghost" to={r('usuarios/nuevo')}>
            Crear cuenta kiosco
          </LinkButton>
        ) : (
          <span className="text-muted">Sin cuenta</span>
        )}
      </div>
    </Card>
  );
}

export function KioscoQr() {
  const { cds, alcance, cargandoCds } = usePanel();
  const lista = cds.filter((c) => !alcance || c.id === alcance);
  return (
    <>
      <Encabezado
        titulo="Kiosco QR"
        sub="Código dinámico en el teléfono fijo de cada garita (método secundario)"
      />
      {cargandoCds ? (
        <Cargando />
      ) : lista.length === 0 ? (
        <Card>
          <Vacio titulo="No hay CD configurados" />
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3.5">
          {lista.map((c) => (
            <TarjetaKiosco key={c.id} c={c} />
          ))}
        </div>
      )}
      <Card className="mt-4 text-[13px] text-muted">
        <b className="text-text">¿Cómo se configura un kiosco?</b> 1) En Usuarios crea un usuario con rol
        “Kiosco QR” y el correo de la cuenta del teléfono fijo. 2) En ese teléfono abre la app e inicia sesión
        con esa cuenta. 3) Toca “Pantalla completa” y déjalo conectado al cargador. El código se renueva solo
        (una escritura por hora).
      </Card>
    </>
  );
}
