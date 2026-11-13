import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { Switch, Tabs, mensajeError } from './misc';
import { ToastProvider, useToast } from './Toast';

describe('componentes base', () => {
  it('Button muestra estado de carga y se deshabilita', () => {
    render(<Button cargando>Guardar</Button>);
    const b = screen.getByRole('button', { name: 'Guardar' });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute('aria-busy', 'true');
  });

  it('Dialog es modal, accesible y se cierra con Escape', async () => {
    const cerrar = vi.fn();
    render(
      <Dialog abierto onCerrar={cerrar} titulo="Corregir jornada">
        <input aria-label="Hora" />
      </Dialog>,
    );
    const d = screen.getByRole('dialog', { name: 'Corregir jornada' });
    expect(d).toHaveAttribute('aria-modal', 'true');
    await userEvent.keyboard('{Escape}');
    expect(cerrar).toHaveBeenCalled();
  });

  it('Switch cambia aria-checked', async () => {
    function Demo() {
      const [v, setV] = useState(false);
      return <Switch activo={v} onChange={setV} label="Habilitar QR" />;
    }
    render(<Demo />);
    const s = screen.getByRole('switch', { name: 'Habilitar QR' });
    expect(s).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(s);
    expect(s).toHaveAttribute('aria-checked', 'true');
  });

  it('Tabs marca la pestaña seleccionada', async () => {
    const onChange = vi.fn();
    render(
      <Tabs
        label="Periodo"
        valor="hoy"
        onChange={onChange}
        opciones={[
          { valor: 'hoy', texto: 'Hoy' },
          { valor: 'ayer', texto: 'Ayer' },
        ]}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Hoy' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Ayer' }));
    expect(onChange).toHaveBeenCalledWith('ayer');
  });

  it('Toast aparece en una región viva (no usa alert)', async () => {
    function Demo() {
      const t = useToast();
      return <button onClick={() => t('Jornada corregida')}>ok</button>;
    }
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByText('ok'));
    expect(screen.getByRole('status')).toHaveTextContent('Jornada corregida');
  });

  it('traduce errores de Firebase al español', () => {
    expect(mensajeError({ code: 'permission-denied' })).toBe('No tienes permiso para hacer esto.');
    expect(mensajeError({ code: 'auth/invalid-credential' })).toBe('Correo o contraseña incorrectos.');
  });
});

import { normalizarHora } from '../HoraInput';
describe('HoraInput', () => {
  it('normaliza a 24 h', () => {
    expect(normalizarHora('2205')).toBe('22:05');
    expect(normalizarHora('6:30')).toBe('06:30');
    expect(normalizarHora('630')).toBe('06:30');
    expect(normalizarHora('25:00')).toBe('');
    expect(normalizarHora('12')).toBe('');
  });
});
