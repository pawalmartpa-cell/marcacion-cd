import type { ReactNode } from 'react';
import type { Tono } from '@/lib/jornada';
import { cx } from './cx';

export type TonoChip = Tono | 'navy' | 'pur' | 'yel';

const TONOS: Record<TonoChip, string> = {
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  bad: 'bg-bad-bg text-bad',
  info: 'bg-info-bg text-info',
  neutral: 'bg-track text-muted',
  navy: 'bg-wm-navy text-wm-yellow dark:bg-wm-yellow dark:text-wm-navy',
  pur: 'bg-[#EDE7FB] text-[#4B2E9B] dark:bg-[#2E2357] dark:text-[#D6CBFA]',
  yel: 'bg-[#FFF3CC] text-[#6B4E00] dark:bg-[#3A2E0A] dark:text-[#FFD766]',
};

export function Chip({
  tono = 'neutral',
  children,
  className,
}: {
  tono?: TonoChip;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold',
        TONOS[tono],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Punto({ color, label }: { color: string; label?: string }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ background: color }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
