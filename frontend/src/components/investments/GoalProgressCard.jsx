import { Target, Calendar, TrendingUp } from 'lucide-react';

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function GoalProgressCard({ goal, onSelect }) {
  const progressPct = Math.min(100, goal.progressPct || 0);

  return (
    <div
      className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onSelect?.(goal)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
            <Target className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white truncate">{goal.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {goal.monthsRemaining} meses restantes
            </p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-primary-600 dark:text-primary-400 tabular-nums">
            {formatCurrency(goal.targetAmount)}
          </p>
          <p className="text-xs text-gray-400">alvo</p>
        </div>
      </div>

      <div className="space-y-1.5 mb-3">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{formatCurrency(goal.currentAmount)} acumulado</span>
          <span className="font-semibold text-primary-600 dark:text-primary-400">{progressPct.toFixed(1)}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-700"
            style={{ width: `${progressPct}%`, minWidth: progressPct > 0 ? '4px' : 0 }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <TrendingUp size={12} />
          Aporte: {formatCurrency(goal.monthlyContribution)}/mês
        </span>
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          {new Date(goal.targetDate).toLocaleDateString('pt-BR')}
        </span>
      </div>
    </div>
  );
}
