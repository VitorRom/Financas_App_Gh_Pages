import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmContext = createContext(null);

/**
 * Substitui o `confirm()` nativo, que trava a aba e ignora o tema da aplicação.
 * Uso: `if (!(await confirm({ title, message, confirmLabel }))) return;`
 */
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolver = useRef(null);
  const confirmButton = useRef(null);

  const confirm = useCallback((options) => {
    setRequest({
      title: 'Tem certeza?',
      message: '',
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      destructive: true,
      ...options,
    });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((answer) => {
    setRequest(null);
    resolver.current?.(answer);
    resolver.current = null;
  }, []);

  useEffect(() => {
    if (!request) return undefined;
    confirmButton.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') settle(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [request, settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm"
          onClick={() => settle(false)}
          role="presentation"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-4 p-5">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  request.destructive
                    ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                    : 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400'
                }`}
                aria-hidden
              >
                <AlertTriangle size={20} />
              </span>
              <div className="min-w-0">
                <h2 id="confirm-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                  {request.title}
                </h2>
                {request.message && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">
                    {request.message}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button type="button" className="btn btn-secondary flex-1" onClick={() => settle(false)}>
                {request.cancelLabel}
              </button>
              <button
                type="button"
                ref={confirmButton}
                className={`btn flex-1 ${request.destructive ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => settle(true)}
              >
                {request.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm deve ser usado dentro de ConfirmProvider');
  return ctx;
}
