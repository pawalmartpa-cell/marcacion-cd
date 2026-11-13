import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type Tipo = 'info' | 'ok' | 'error';
interface ToastItem {
  id: number;
  texto: string;
  tipo: Tipo;
}

const Ctx = createContext<(texto: string, tipo?: Tipo) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const n = useRef(0);
  const mostrar = useCallback((texto: string, tipo: Tipo = 'info') => {
    const id = ++n.current;
    setItems((xs) => [...xs.slice(-2), { id, texto, tipo }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tipo === 'error' ? 5000 : 3000);
  }, []);
  return (
    <Ctx.Provider value={mostrar}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 right-5 z-[1100] flex max-w-[90vw] flex-col items-end gap-2"
        role="status"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2.5 rounded-xl bg-wm-navy px-[18px] py-3.5 font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,.25)] dark:bg-[#1F3E6E]"
          >
            <i
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: t.tipo === 'error' ? '#FF6B57' : t.tipo === 'ok' ? '#4ADE80' : '#FFC220' }}
              aria-hidden
            />
            <span>{t.texto}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
