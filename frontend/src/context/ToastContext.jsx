import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const VARIANTS = {
  success: {
    Icon: CheckCircle2,
    bar: 'bg-emerald-500',
    icon: 'text-emerald-500',
  },
  error: {
    Icon: XCircle,
    bar: 'bg-red-500',
    icon: 'text-red-500',
  },
  warning: {
    Icon: AlertTriangle,
    bar: 'bg-amber-500',
    icon: 'text-amber-500',
  },
  info: {
    Icon: Info,
    bar: 'bg-primary-500',
    icon: 'text-primary-500',
  },
};

const DEFAULT_DURATION = 5000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (variant, message, { title, duration = DEFAULT_DURATION } = {}) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, variant, message, title }]);

      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  const toast = useMemo(
    () => ({
      success: (message, options) => push('success', message, options),
      error: (message, options) => push('error', message, { duration: 8000, ...options }),
      warning: (message, options) => push('warning', message, options),
      info: (message, options) => push('info', message, options),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(24rem,calc(100vw-2rem))] pointer-events-none"
        role="region"
        aria-live="polite"
        aria-label="Notificações"
      >
        {toasts.map((t) => {
          const { Icon, bar, icon } = VARIANTS[t.variant] || VARIANTS.info;
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex gap-3 overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-lg ring-1 ring-gray-200 dark:ring-gray-700 animate-[toast-in_180ms_ease-out]"
            >
              <span className={`w-1 shrink-0 ${bar}`} aria-hidden />
              <div className="flex gap-3 py-3 pr-3 flex-1 min-w-0">
                <Icon size={18} className={`${icon} shrink-0 mt-0.5`} aria-hidden />
                <div className="min-w-0 flex-1">
                  {t.title && (
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">{t.title}</p>
                  )}
                  <p className="text-sm text-gray-600 dark:text-gray-300 break-words whitespace-pre-line">
                    {t.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  className="shrink-0 self-start p-1 -m-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  aria-label="Fechar aviso"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return ctx;
}
