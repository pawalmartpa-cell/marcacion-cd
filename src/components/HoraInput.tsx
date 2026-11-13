import { forwardRef, useEffect, useState, type InputHTMLAttributes } from 'react';
import { minutosDeHHMM } from '@/lib/fechas';
import { cx } from './ui';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string;
  onChange: (v: string) => void;
}

/** Normaliza lo que escribe el usuario a 'HH:mm' (24 h). Devuelve '' si está incompleto. */
export function normalizarHora(txt: string): string {
  const d = txt.replace(/\D/g, '').slice(0, 4);
  if (d.length < 3) return '';
  const hh = d.length === 3 ? `0${d[0]}` : d.slice(0, 2);
  const mm = d.slice(-2);
  const v = `${hh}:${mm}`;
  return minutosDeHHMM(v) == null ? '' : v;
}

/**
 * Campo de hora siempre en formato de 24 h (hh:mm), sin depender del idioma del teléfono
 * (el <input type="time"> muestra AM/PM en algunos equipos).
 */
export const HoraInput = forwardRef<HTMLInputElement, Props>(function HoraInput(
  { value, onChange, className, ...rest },
  ref,
) {
  const [txt, setTxt] = useState(value);
  useEffect(() => setTxt(value), [value]);
  const invalido = txt !== '' && normalizarHora(txt) === '' && txt.replace(/\D/g, '').length >= 3;
  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="hh:mm"
      maxLength={5}
      value={txt}
      aria-invalid={invalido || undefined}
      onChange={(e) => {
        let t = e.target.value.replace(/[^\d:]/g, '');
        const dig = t.replace(/\D/g, '');
        if (!t.includes(':') && dig.length > 2) t = `${dig.slice(0, 2)}:${dig.slice(2, 4)}`;
        setTxt(t);
        const n = normalizarHora(t);
        onChange(n);
      }}
      onBlur={() => {
        const n = normalizarHora(txt);
        if (n) setTxt(n);
      }}
      className={cx('tabular', invalido && '!border-bad', className)}
      {...rest}
    />
  );
});
