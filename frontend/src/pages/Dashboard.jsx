import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Zap,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { dashboardAPI, transactionsAPI, goalsAPI, investmentsAPI } from '../services/api.js';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// SVG circular gauge for savings rate
function SavingsGauge({ rate }) {
  const clampedRate = Math.min(100, Math.max(0, rate));
  const r = 48;
  const circumference = 2 * Math.PI * r;
  const dash = (clampedRate / 100) * circumference;

  let color = '#ef4444'; // red
  let label = 'Atenção';
  let labelColor = 'text-red-500';
  if (clampedRate >= 20) { color = '#10b981'; label = 'Ótimo'; labelColor = 'text-emerald-500'; }
  else if (clampedRate >= 10) { color = '#f59e0b'; label = 'Bom'; labelColor = 'text-amber-500'; }

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 120 120" className="w-28 h-28">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" className="dark:stroke-gray-700" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x="60" y="56" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor" className="fill-gray-900 dark:fill-white">
          {clampedRate.toFixed(0)}%
        </text>
        <text x="60" y="72" textAnchor="middle" fontSize="10" fill="#6b7280">
          poupança
        </text>
      </svg>
      <span className={`text-xs font-semibold ${labelColor}`}>{label}</span>
    </div>
  );
}

// Horizontal bar for category spending
function CategoryBar({ name, value, total, color }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-700 dark:text-gray-300 truncate max-w-[60%]">{name}</span>
        <span className="font-medium text-gray-900 dark:text-white tabular-nums">{formatCurrency(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// Goal progress card
function GoalCard({ goal }) {
  const schedule = goal.installments || [];
  const paid = schedule.filter((r) => r.status === 'Ok' || r.status === 'OK' || r.status === 'Pago').length;
  const total = schedule.length;
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  const remaining = total - paid;

  // Find next pending installment
  const nextInstallment = schedule.find(
    (r) => r.status !== 'Ok' && r.status !== 'OK' && r.status !== 'Pago'
  );

  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
            <Target className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white truncate">{goal.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{goal.years} anos · {total} parcelas</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatCurrency(goal.targetFinalValue)}
          </p>
          <p className="text-xs text-gray-400">alvo</p>
        </div>
      </div>

      <div className="space-y-1.5 mb-3">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{paid} de {total} parcelas pagas</span>
          <span className="font-semibold text-primary-600 dark:text-primary-400">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-700"
            style={{ width: `${pct}%`, minWidth: pct > 0 ? '4px' : 0 }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 dark:text-gray-400">
          Aporte mensal:{' '}
          <span className="font-semibold text-gray-800 dark:text-gray-200 tabular-nums">
            {formatCurrency(goal.monthlyContribution)}
          </span>
        </span>
        {remaining > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium">
            {remaining} restantes
          </span>
        )}
        {remaining === 0 && total > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Concluída
          </span>
        )}
      </div>
    </div>
  );
}

const CATEGORY_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [investmentSummary, setInvestmentSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [summaryData, transactions, goalsData, invSummary] = await Promise.all([
        dashboardAPI.getSummary(),
        transactionsAPI.getAll(),
        goalsAPI.list(),
        investmentsAPI.getSummary().catch(() => null),
      ]);
      setSummary(summaryData);
      setRecentTransactions(transactions.slice(0, 5));
      setGoals(goalsData);
      setInvestmentSummary(invSummary);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="h-10 w-10 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">Carregando dashboard…</p>
      </div>
    );
  }

  const income = summary?.totalIncome || 0;
  const expense = summary?.totalExpense || 0;
  const balance = summary?.balance || 0;
  const accountsBalance = summary?.accountsBalance || 0;
  const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;
  const spentPct = income > 0 ? Math.min(100, (expense / income) * 100) : 0;

  const categoryEntries = summary?.expensesByCategory
    ? Object.entries(summary.expensesByCategory)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
    : [];

  const topCategoryTotal = categoryEntries.reduce((s, [, v]) => s + v, 0);

  // Budget health insight
  let insight = null;
  if (income === 0) {
    insight = { type: 'info', text: 'Adicione uma receita para ver sua saúde financeira.' };
  } else if (savingsRate < 0) {
    insight = { type: 'danger', text: 'Suas despesas superaram as receitas este mês. Revise os gastos.' };
  } else if (savingsRate < 10) {
    insight = { type: 'warning', text: `Você está economizando apenas ${savingsRate.toFixed(0)}%. Tente chegar a 20%.` };
  } else if (savingsRate >= 20) {
    insight = { type: 'success', text: `Parabéns! Você está economizando ${savingsRate.toFixed(0)}% da sua renda este mês.` };
  } else {
    insight = { type: 'info', text: `Você economizou ${savingsRate.toFixed(0)}% este mês. Meta sugerida: 20%.` };
  }

  const insightStyles = {
    success: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
    warning: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
    danger: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    info: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
  };
  const insightIcons = {
    success: <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />,
    warning: <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />,
    danger: <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />,
    info: <Zap className="w-4 h-4 shrink-0 text-blue-500" />,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Visão Geral
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
          {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Insight Banner */}
      {insight && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${insightStyles[insight.type]}`}>
          {insightIcons[insight.type]}
          {insight.text}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Saldo nas Contas"
          value={accountsBalance}
          icon={Wallet}
          color={accountsBalance >= 0 ? 'blue' : 'red'}
          subtitle="Total disponível"
        />
        <SummaryCard
          title="Receitas"
          value={income}
          icon={TrendingUp}
          color="green"
          subtitle="Este mês"
        />
        <SummaryCard
          title="Despesas"
          value={expense}
          icon={TrendingDown}
          color="red"
          subtitle="Este mês"
        />
        <SummaryCard
          title="Economizado"
          value={balance}
          icon={TrendingUp}
          color={balance >= 0 ? 'purple' : 'red'}
          subtitle={income > 0 ? `${savingsRate.toFixed(0)}% da renda` : 'Este mês'}
        />
      </div>

      {/* Investment Summary */}
      {investmentSummary && investmentSummary.totalAssets > 0 && (
        <div className="card bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 border border-indigo-100 dark:border-indigo-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                <TrendingUp size={20} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Patrimônio Investido</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{formatCurrency(investmentSummary.totalCurrent)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold tabular-nums ${investmentSummary.totalGain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {investmentSummary.totalGain >= 0 ? '+' : ''}{investmentSummary.totalGainPct.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{investmentSummary.totalAssets} ativos</p>
            </div>
          </div>
        </div>
      )}

      {/* Main content: Goals + Health */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Metas em Destaque */}
        <div className="lg:col-span-3 card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              Metas em Destaque
            </h3>
            <Link
              to="/goals"
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 font-medium"
            >
              Ver todas <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {goals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-10 text-center">
              <Target className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="font-medium text-gray-500 dark:text-gray-400">Nenhuma meta criada</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 mb-4">
                Crie metas como Carro, Casa ou Viagem e acompanhe aqui.
              </p>
              <Link
                to="/goals"
                className="btn btn-primary inline-flex items-center gap-2 text-sm"
              >
                <Target className="w-4 h-4" /> Criar primeira meta
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {goals.slice(0, 3).map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
              {goals.length > 3 && (
                <p className="text-center text-sm text-gray-400 dark:text-gray-500">
                  +{goals.length - 3} meta{goals.length - 3 > 1 ? 's' : ''} —{' '}
                  <Link to="/goals" className="text-primary-600 dark:text-primary-400 hover:underline font-medium">
                    ver todas
                  </Link>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Saúde Financeira */}
        <div className="lg:col-span-2 card space-y-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Saúde do Mês
          </h3>

          {/* Savings Gauge */}
          <div className="flex flex-col items-center gap-2">
            <SavingsGauge rate={savingsRate} />
            <div className="w-full space-y-1.5">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Orçamento usado</span>
                <span className="font-semibold tabular-nums">{spentPct.toFixed(0)}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    spentPct > 90 ? 'bg-red-500' : spentPct > 70 ? 'bg-amber-400' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${spentPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs tabular-nums text-gray-400 dark:text-gray-500">
                <span>{formatCurrency(expense)} gasto</span>
                <span>{formatCurrency(income)} recebido</span>
              </div>
            </div>
          </div>

          {/* Top Categories */}
          {categoryEntries.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Onde você mais gasta</p>
              <div className="space-y-2.5">
                {categoryEntries.map(([name, value], i) => (
                  <CategoryBar
                    key={name}
                    name={name}
                    value={value}
                    total={topCategoryTotal}
                    color={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                  />
                ))}
              </div>
            </div>
          )}

          {categoryEntries.length === 0 && income === 0 && (
            <div className="text-center py-4 text-sm text-gray-400 dark:text-gray-500">
              Adicione transações para ver sua saúde financeira
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Últimas Transações</h3>
          <Link
            to="/transactions"
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 font-medium"
          >
            Ver todas <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {recentTransactions.length > 0 ? (
          <div className="space-y-1">
            {recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between py-3 px-1 border-b border-gray-50 dark:border-gray-800 last:border-0 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      transaction.type === 'income'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30'
                        : 'bg-red-100 dark:bg-red-900/30'
                    }`}
                  >
                    {transaction.type === 'income' ? (
                      <ArrowUpRight className="text-emerald-600 dark:text-emerald-400" size={18} />
                    ) : (
                      <ArrowDownRight className="text-red-500 dark:text-red-400" size={18} />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{transaction.description}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {transaction.category?.name || 'Sem categoria'} ·{' '}
                      {format(new Date(transaction.date), 'dd MMM', { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <p
                  className={`font-semibold tabular-nums text-sm ${
                    transaction.type === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-500 dark:text-red-400'
                  }`}
                >
                  {transaction.type === 'income' ? '+' : '-'}
                  {formatCurrency(transaction.amount)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <p className="text-gray-400 dark:text-gray-500 text-sm">Nenhuma transação registrada ainda</p>
            <Link to="/transactions" className="btn btn-primary mt-3 inline-flex items-center gap-2 text-sm">
              Adicionar transação
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, color, subtitle }) {
  const colors = {
    green: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      icon: 'text-emerald-600 dark:text-emerald-400',
      value: 'text-emerald-700 dark:text-emerald-300',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      icon: 'text-red-500 dark:text-red-400',
      value: 'text-red-600 dark:text-red-400',
      iconBg: 'bg-red-100 dark:bg-red-900/40',
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      icon: 'text-blue-600 dark:text-blue-400',
      value: 'text-blue-700 dark:text-blue-300',
      iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    },
    purple: {
      bg: 'bg-violet-50 dark:bg-violet-900/20',
      icon: 'text-violet-600 dark:text-violet-400',
      value: 'text-violet-700 dark:text-violet-300',
      iconBg: 'bg-violet-100 dark:bg-violet-900/40',
    },
  };

  const c = colors[color] || colors.blue;

  return (
    <div className={`card ${c.bg} border border-transparent`}>
      <div className={`w-9 h-9 rounded-lg ${c.iconBg} flex items-center justify-center mb-3`}>
        <Icon size={18} className={c.icon} />
      </div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</p>
      <p className={`text-xl font-bold mt-0.5 tabular-nums ${c.value}`}>{formatCurrency(value)}</p>
      {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}
