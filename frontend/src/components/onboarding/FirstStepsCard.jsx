import { Link } from 'react-router-dom';
import { Check, ChevronRight, X, Wallet, ArrowLeftRight, Target } from 'lucide-react';

/**
 * Lista de primeiros passos do Dashboard.
 *
 * O estado de cada item vem dos dados reais — não de um contador de onboarding —
 * então ela reflete a verdade mesmo se o usuário fizer as coisas fora de ordem,
 * e some sozinha quando os três estiverem prontos.
 */
export default function FirstStepsCard({ hasAccounts, hasTransactions, hasGoals, onDismiss }) {
  const steps = [
    {
      id: 'contas',
      done: hasAccounts,
      icon: Wallet,
      title: 'Cadastre suas contas',
      description: 'Conta corrente, cartão, dinheiro — de onde o saldo vem.',
      to: '/accounts',
      cta: 'Criar conta',
    },
    {
      id: 'transacoes',
      done: hasTransactions,
      icon: ArrowLeftRight,
      title: 'Registre ou importe transações',
      description: 'Lance à mão ou envie o extrato do banco em PDF ou Excel.',
      to: '/transactions',
      cta: 'Adicionar transação',
    },
    {
      id: 'metas',
      done: hasGoals,
      icon: Target,
      title: 'Defina uma meta',
      description: 'O aporte mensal necessário é calculado para você.',
      to: '/goals',
      cta: 'Criar meta',
    },
  ];

  const concluidos = steps.filter((s) => s.done).length;
  if (concluidos === steps.length) return null;

  const proximo = steps.find((s) => !s.done);

  return (
    <section
      className="relative overflow-hidden rounded-xl border border-primary-100 bg-gradient-to-br from-primary-50 to-white p-5 dark:border-primary-900/40 dark:from-primary-950/30 dark:to-gray-800"
      aria-labelledby="primeiros-passos-titulo"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary-500/10 blur-3xl"
        aria-hidden
      />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <h3 id="primeiros-passos-titulo" className="font-semibold text-gray-900 dark:text-white">
            Primeiros passos
          </h3>
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
            {concluidos === 0
              ? 'Seu Dashboard começa zerado. Três passos para ele ganhar vida.'
              : `${concluidos} de ${steps.length} concluídos — falta pouco.`}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="-m-1 shrink-0 rounded p-1 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
          aria-label="Ocultar primeiros passos"
        >
          <X size={16} />
        </button>
      </div>

      <div
        className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-primary-100 dark:bg-primary-900/40"
        role="progressbar"
        aria-valuenow={concluidos}
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-label="Progresso dos primeiros passos"
      >
        <div
          className="h-full rounded-full bg-primary-600 transition-all duration-500 dark:bg-primary-400"
          style={{ width: `${(concluidos / steps.length) * 100}%` }}
        />
      </div>

      <ul className="relative mt-4 space-y-2">
        {steps.map((step) => {
          const Icon = step.icon;
          const isNext = step.id === proximo?.id;
          return (
            <li key={step.id}>
              <div
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                  step.done
                    ? 'border-transparent bg-white/60 dark:bg-gray-800/40'
                    : isNext
                      ? 'border-primary-200 bg-white dark:border-primary-800/60 dark:bg-gray-800'
                      : 'border-transparent bg-white/60 dark:bg-gray-800/40'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    step.done
                      ? 'bg-emerald-500 text-white'
                      : 'bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400'
                  }`}
                  aria-hidden
                >
                  {step.done ? <Check size={14} strokeWidth={3} /> : <Icon size={14} />}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-medium ${
                      step.done
                        ? 'text-gray-400 line-through dark:text-gray-500'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {step.title}
                  </span>
                  {!step.done && (
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{step.description}</span>
                  )}
                </span>

                {step.done ? (
                  <span className="sr-only">concluído</span>
                ) : (
                  <Link
                    to={step.to}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      isNext
                        ? 'bg-primary-600 text-white hover:bg-primary-700'
                        : 'text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30'
                    }`}
                  >
                    {step.cta}
                    <ChevronRight size={13} aria-hidden />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
