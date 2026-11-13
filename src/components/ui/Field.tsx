import { useId, type ReactElement, cloneElement, type ReactNode } from 'react';

interface Props {
  label: ReactNode;
  error?: string;
  ayuda?: ReactNode;
  children: ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>;
  className?: string;
}

export function Field({ label, error, ayuda, children, className }: Props) {
  const id = useId();
  const descId = `${id}-desc`;
  return (
    <div className={'flex flex-col gap-1.5 ' + (className ?? '')}>
      <label htmlFor={id} className="text-[13px] font-semibold">
        {label}
      </label>
      {cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error || ayuda ? descId : undefined,
      })}
      {(error || ayuda) && (
        <span
          id={descId}
          className={'text-xs ' + (error ? 'font-semibold text-bad' : 'text-muted')}
          role={error ? 'alert' : undefined}
        >
          {error || ayuda}
        </span>
      )}
    </div>
  );
}
