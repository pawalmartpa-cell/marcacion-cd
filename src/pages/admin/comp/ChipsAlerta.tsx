import type { Severidad } from '@/types';
import { Chip } from '@/components/ui';

export const SEVERIDAD: Record<Severidad, { texto: string; tono: 'bad' | 'warn' | 'info' }> = {
  alta: { texto: 'Alta', tono: 'bad' },
  media: { texto: 'Media', tono: 'warn' },
  info: { texto: 'Info', tono: 'info' },
};

export function ChipSeveridad({ s }: { s: Severidad }) {
  return <Chip tono={SEVERIDAD[s].tono}>{SEVERIDAD[s].texto}</Chip>;
}
