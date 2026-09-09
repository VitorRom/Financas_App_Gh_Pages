import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Bloco de estado para uma área que não conseguiu carregar ou não tem dados.
 * Antes essas falhas eram engolidas por `.catch(() => {})` e a aba simplesmente
 * ficava em branco, sem nenhuma pista do que aconteceu.
 */
export function ErrorState({ message, onRetry, compact = false }) {
  return (
    <div
      role="alert"
      className={`rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 text-center ${
        compact ? 'px-4 py-6' : 'px-6 py-10'
      }`}
    >
      <AlertCircle
        className={`mx-auto text-red-500 dark:text-red-400 ${compact ? 'w-6 h-6 mb-2' : 'w-8 h-8 mb-3'}`}
        aria-hidden
      />
      <p className="font-medium text-red-900 dark:text-red-200">Não foi possível carregar</p>
      <p className="mt-1 text-sm text-red-800/80 dark:text-red-300/80 max-w-md mx-auto">
        {message || 'Verifique sua conexão e tente novamente.'}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-secondary mt-4 inline-flex items-center gap-2 text-sm"
        >
          <RefreshCw size={15} />
          Tentar de novo
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, compact = false }) {
  return (
    <div
      className={`rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-center ${
        compact ? 'px-4 py-8' : 'px-6 py-14'
      }`}
    >
      {Icon && (
        <Icon
          className={`mx-auto text-gray-300 dark:text-gray-600 ${compact ? 'w-8 h-8 mb-2' : 'w-12 h-12 mb-3'}`}
          aria-hidden
        />
      )}
      <p className="font-medium text-gray-600 dark:text-gray-300">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-gray-400 dark:text-gray-500 max-w-md mx-auto">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Carregando…', compact = false }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${compact ? 'h-32' : 'h-64'}`}>
      <div
        className="h-9 w-9 rounded-full border-2 border-primary-500 border-t-transparent animate-spin"
        aria-hidden
      />
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <span className="sr-only" role="status">
        {label}
      </span>
    </div>
  );
}
