export function cx(...c: Array<string | false | null | undefined>): string {
  return c.filter(Boolean).join(' ');
}
