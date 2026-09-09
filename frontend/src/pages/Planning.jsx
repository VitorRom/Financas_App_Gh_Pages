import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  Landmark,
  TrendingUp,
  TrendingDown,
  Wallet,
  LineChart,
  ListChecks,
  Trash2,
  PiggyBank,
  ArrowDownCircle,
  ArrowUpCircle,
  Pencil,
  X,
  ChevronDown,
  ChevronRight,
  Calendar,
  CircleDollarSign,
  Inbox,
} from 'lucide-react';
import { planningAPI, accountsAPI } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import { ErrorState, LoadingState } from '../components/ui/StateMessage.jsx';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

/**
 * Meses de um item são absolutos: cada item guarda `startDate`, o primeiro dia do
 * mês em que ele começa. Antes o campo era `startMonth`, um deslocamento em meses
 * contado a partir de "hoje" — como "hoje" muda, o item era empurrado para o mês
 * seguinte a cada virada de mês e nunca chegava. Comparar índices absolutos
 * (ano × 12 + mês) elimina isso de vez.
 */
function monthIndexFromDate(date) {
  return date.getFullYear() * 12 + date.getMonth();
}

/** O `startDate` é gravado em UTC, então precisa ser lido em UTC. */
function monthIndexFromIso(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

function monthIndexToLabel(index) {
  const d = new Date(Math.floor(index / 12), index % 12, 1);
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

/** Valor para `<input type="month">` — sempre no fuso UTC do dado guardado. */
function isoToMonthInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function currentMonthInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** "novembro de 2026" ou "novembro de 2026 → janeiro de 2027" para o formulário. */
function monthInputRangeLabel(startInput, duration) {
  if (!startInput) return '';
  const [year, month] = startInput.split('-').map(Number);
  if (!year || !month) return '';

  const start = year * 12 + (month - 1);
  const meses = Number(duration);
  if (!Number.isFinite(meses) || meses <= 1) return monthIndexToLabel(start);
  return `${monthIndexToLabel(start)} → ${monthIndexToLabel(start + meses - 1)}`;
}

/**
 * Mês de início do item, em índice absoluto.
 *
 * `startDate` é a fonte da verdade. O segundo caminho existe para o caso de a API
 * ainda não devolver o campo — uma versão anterior do backend em execução, por
 * exemplo. Nesse caso o mês é reconstruído a partir de `createdAt + startMonth`,
 * exatamente a mesma regra do backfill, em vez de deixar o item sem âncora: sem
 * âncora ele seria considerado ativo em todos os meses, e a projeção inteira ficaria
 * errada de um jeito difícil de perceber.
 */
function itemStartMonthIndex(item) {
  if (item.startDate) return monthIndexFromIso(item.startDate);

  if (item.createdAt) {
    const criado = new Date(item.createdAt);
    if (!Number.isNaN(criado.getTime())) {
      return criado.getUTCFullYear() * 12 + criado.getUTCMonth() + (item.startMonth ?? 0);
    }
  }

  return null;
}

/**
 * Janela de atividade do item, em índices absolutos de mês.
 * `end` é exclusivo; `null` significa vitalício.
 */
function itemWindow(item) {
  const start = itemStartMonthIndex(item);
  if (start == null) return { start: null, end: null };
  return {
    start,
    end: item.monthsDuration == null ? null : start + item.monthsDuration,
  };
}

function FragmentRow({ row, idx, isOpen, onToggle, items, isItemActiveInMonth }) {
  return (
    <Fragment>
      <tr
        onClick={onToggle}
        aria-expanded={isOpen}
        className={`cursor-pointer transition-colors hover:bg-primary-50/60 dark:hover:bg-primary-900/20 ${
          isOpen
            ? 'bg-primary-50/80 dark:bg-primary-950/30'
            : idx % 2 === 0
              ? 'bg-white dark:bg-gray-900/30'
              : 'bg-gray-50/40 dark:bg-gray-800/20'
        }`}
      >
        <td className="p-3.5 align-middle">
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-transform ${
              isOpen
                ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rotate-90'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}
          >
            {isOpen ? <ChevronDown className="w-4 h-4 -rotate-90" /> : <ChevronRight className="w-4 h-4" />}
          </span>
        </td>
        <td className="p-3.5 capitalize font-medium text-gray-900 dark:text-gray-100">
          <div className="flex items-center gap-2">
            <span>{row.month}</span>
            {isOpen && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-300 text-[10px] font-semibold uppercase tracking-wide">
                Detalhes
              </span>
            )}
          </div>
        </td>
        <td className="p-3.5 text-right tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
          {formatCurrency(row.income)}
        </td>
        <td className="p-3.5 text-right tabular-nums font-medium text-rose-700 dark:text-rose-400">
          {formatCurrency(row.expense)}
        </td>
        <td
          className={`p-3.5 text-right tabular-nums font-semibold ${
            row.net >= 0 ? 'text-sky-700 dark:text-sky-300' : 'text-amber-700 dark:text-amber-300'
          }`}
        >
          {formatCurrency(row.net)}
        </td>
        <td
          className={`p-3.5 text-right tabular-nums font-bold ${
            row.balance >= 0 ? 'text-primary-700 dark:text-primary-300' : 'text-red-600 dark:text-red-400'
          }`}
        >
          {formatCurrency(row.balance)}
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-gray-50/60 dark:bg-gray-900/40">
          <td colSpan={6} className="p-0">
            <MonthDetail row={row} items={items} isItemActiveInMonth={isItemActiveInMonth} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function MonthDetail({ row, items, isItemActiveInMonth }) {
  const incomes = items.filter(
    (it) => it.enabled && it.type === 'income' && isItemActiveInMonth(it, row.monthIndex),
  );
  const expenses = items.filter(
    (it) => it.enabled && it.type === 'expense' && isItemActiveInMonth(it, row.monthIndex),
  );
  const totalCount = incomes.length + expenses.length;

  function ItemRow({ it }) {
    const { start } = itemWindow(it);
    return (
      <div
        className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border ${
          it.type === 'income'
            ? 'bg-white dark:bg-gray-900/60 border-emerald-100 dark:border-emerald-900/40'
            : 'bg-white dark:bg-gray-900/60 border-rose-100 dark:border-rose-900/40'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-md shrink-0 ${
              it.type === 'income'
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'
            }`}
          >
            {it.type === 'income' ? (
              <ArrowUpCircle className="w-4 h-4" />
            ) : (
              <ArrowDownCircle className="w-4 h-4" />
            )}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{it.name}</div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              <span>dia {it.dayOfMonth}</span>
              {start != null && start === row.monthIndex && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-100/80 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 text-[10px] font-semibold uppercase tracking-wide">
                  primeiro mês
                </span>
              )}
              {it.monthsDuration != null && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100/80 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-[10px] font-semibold uppercase tracking-wide">
                  {it.monthsDuration}x
                </span>
              )}
            </div>
          </div>
        </div>
        <div
          className={`text-sm font-bold tabular-nums shrink-0 ${
            it.type === 'income' ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
          }`}
        >
          {formatCurrency(it.amount)}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900/70 dark:to-gray-800/40 border-t border-gray-200 dark:border-gray-700">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg p-3 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800/80 dark:text-emerald-300/90">
            <CircleDollarSign className="w-3.5 h-3.5" />
            Receitas
          </div>
          <div className="text-base font-bold mt-1 text-emerald-700 dark:text-emerald-300 tabular-nums">
            {formatCurrency(row.income)}
          </div>
        </div>
        <div className="rounded-lg p-3 bg-rose-50/90 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-rose-800/80 dark:text-rose-300/90">
            <CircleDollarSign className="w-3.5 h-3.5" />
            Despesas
          </div>
          <div className="text-base font-bold mt-1 text-rose-700 dark:text-rose-300 tabular-nums">
            {formatCurrency(row.expense)}
          </div>
        </div>
        <div className="rounded-lg p-3 bg-sky-50/90 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/40">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-sky-800/80 dark:text-sky-300/90">
            <TrendingUp className="w-3.5 h-3.5" />
            Sobra
          </div>
          <div
            className={`text-base font-bold mt-1 tabular-nums ${
              row.net >= 0 ? 'text-sky-800 dark:text-sky-200' : 'text-amber-700 dark:text-amber-300'
            }`}
          >
            {formatCurrency(row.net)}
          </div>
        </div>
      </div>

      {totalCount === 0 ? (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 px-3 py-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 justify-center">
          <Inbox className="w-4 h-4" />
          Nenhuma receita ou despesa prevista para este mês.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <ArrowUpCircle className="w-3.5 h-3.5" />
                Receitas ({incomes.length})
              </div>
              <div className="text-xs font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {formatCurrency(row.income)}
              </div>
            </div>
            {incomes.length === 0 ? (
              <div className="text-xs text-gray-500 dark:text-gray-400 italic px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-dashed border-gray-200 dark:border-gray-700">
                Sem receitas neste mês.
              </div>
            ) : (
              <div className="space-y-1.5">
                {incomes.map((it) => (
                  <ItemRow key={it.id} it={it} />
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                <ArrowDownCircle className="w-3.5 h-3.5" />
                Despesas ({expenses.length})
              </div>
              <div className="text-xs font-bold tabular-nums text-rose-700 dark:text-rose-300">
                {formatCurrency(row.expense)}
              </div>
            </div>
            {expenses.length === 0 ? (
              <div className="text-xs text-gray-500 dark:text-gray-400 italic px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-dashed border-gray-200 dark:border-gray-700">
                Sem despesas neste mês.
              </div>
            ) : (
              <div className="space-y-1.5">
                {expenses.map((it) => (
                  <ItemRow key={it.id} it={it} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Tarjas de período do item, sempre em meses absolutos. Um item cuja janela já
 * passou fica marcado como encerrado — senão ele some da projeção sem explicação.
 */
function ItemPeriodBadges({ item }) {
  const { start, end } = itemWindow(item);
  const thisMonth = monthIndexFromDate(new Date());

  const encerrado = end != null && end <= thisMonth;
  const aguardando = start != null && start > thisMonth;

  const base =
    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide';

  return (
    <>
      {start != null && (
        <span className={`${base} bg-sky-100/80 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300`}>
          {end == null
            ? `A partir de ${monthIndexToLabel(start)}`
            : `${monthIndexToLabel(start)} → ${monthIndexToLabel(end - 1)}`}
        </span>
      )}

      {item.monthsDuration != null ? (
        <span className={`${base} bg-amber-100/80 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300`}>
          {item.monthsDuration} {item.monthsDuration === 1 ? 'mês' : 'meses'}
        </span>
      ) : (
        <span className={`${base} bg-violet-100/80 dark:bg-violet-900/40 text-violet-800 dark:text-violet-300`}>
          Vitalícia
        </span>
      )}

      {encerrado && (
        <span className={`${base} bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300`}>
          Encerrada
        </span>
      )}
      {aguardando && (
        <span className={`${base} bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300`}>
          Ainda não começou
        </span>
      )}
    </>
  );
}

export default function Planning() {
  const toast = useToast();
  const confirm = useConfirm();
  const [loadError, setLoadError] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthsAhead, setMonthsAhead] = useState(12);
  const [manualAdjustment, setManualAdjustment] = useState('0');
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({
    name: '',
    amount: '',
    type: 'expense',
    dayOfMonth: 1,
    monthsDuration: '',
    startDate: currentMonthInput(),
  });
  const [editing, setEditing] = useState(null);
  const [expandedMonth, setExpandedMonth] = useState(null);

  function toggleMonth(key) {
    setExpandedMonth((prev) => (prev === key ? null : key));
  }

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const [data, accs] = await Promise.all([planningAPI.list(), accountsAPI.getAll()]);
      setItems(data);
      setAccounts(accs || []);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  /** @param {number} monthIndex índice absoluto de mês (ano × 12 + mês) */
  function isItemActiveInMonth(item, monthIndex) {
    if (!item.enabled) return false;
    const { start, end } = itemWindow(item);
    if (start == null) return true; // item antigo, sem mês de início: sempre ativo
    if (monthIndex < start) return false;
    return end == null || monthIndex < end;
  }

  const totals = useMemo(() => {
    const thisMonth = monthIndexFromDate(new Date());
    const income = items
      .filter((i) => i.enabled && i.type === 'income' && isItemActiveInMonth(i, thisMonth))
      .reduce((s, i) => s + Number(i.amount), 0);
    const expense = items
      .filter((i) => i.enabled && i.type === 'expense' && isItemActiveInMonth(i, thisMonth))
      .reduce((s, i) => s + Number(i.amount), 0);
    return { income, expense, net: income - expense };
  }, [items]);

  /**
   * Valor de uma conta. Contas de investimento guardam `balance = 0` — o que elas
   * valem vem das posições dos ativos, que a API manda em `investedValue`.
   */
  const accountValue = (account) =>
    account.type === 'investment' ? account.investedValue || 0 : account.balance || 0;

  const cashTotal = useMemo(
    () => accounts.filter((a) => a.type !== 'investment').reduce((sum, a) => sum + accountValue(a), 0),
    [accounts],
  );

  const investedTotal = useMemo(
    () => accounts.filter((a) => a.type === 'investment').reduce((sum, a) => sum + accountValue(a), 0),
    [accounts],
  );

  // Aqui o investimento entra: a projeção é de patrimônio ao longo do tempo, e o que
  // já está investido faz parte do ponto de partida. (No Dashboard não entra, porque
  // lá o número é de caixa disponível — são perguntas diferentes.)
  const currentAccountsTotal = cashTotal + investedTotal;

  const debtsTotal = useMemo(
    () => accounts
      .filter((a) => a.type !== 'investment' && (a.balance || 0) < 0)
      .reduce((s, a) => s + a.balance, 0),
    [accounts]
  );

  const baseBalance = currentAccountsTotal + (Number.parseFloat(manualAdjustment) || 0);

  const projection = useMemo(() => {
    const start = new Date();
    const months = Number(monthsAhead) || 12;
    let balance = baseBalance;
    const rows = [];

    for (let i = 0; i < months; i++) {
      const d = addMonths(start, i);
      const absoluteMonth = monthIndexFromDate(d);

      const monthIncome = items
        .filter((it) => it.type === 'income' && isItemActiveInMonth(it, absoluteMonth))
        .reduce((s, it) => s + Number(it.amount), 0);
      const monthExpense = items
        .filter((it) => it.type === 'expense' && isItemActiveInMonth(it, absoluteMonth))
        .reduce((s, it) => s + Number(it.amount), 0);
      const monthNet = monthIncome - monthExpense;

      balance += monthNet;
      const labelShort = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      rows.push({
        key: `${d.getFullYear()}-${d.getMonth() + 1}`,
        monthIndex: absoluteMonth,
        month: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        labelShort,
        income: monthIncome,
        expense: monthExpense,
        net: monthNet,
        balance,
      });
    }
    return rows;
  }, [monthsAhead, items, baseBalance]);

  const chartData = useMemo(
    () => projection.map((r) => ({ name: r.labelShort, saldo: r.balance })),
    [projection],
  );

  async function onCreate(e) {
    e.preventDefault();
    try {
      const payload = { ...form };
      if (payload.monthsDuration === '' || payload.monthsDuration == null) {
        delete payload.monthsDuration;
      }
      if (!payload.startDate) delete payload.startDate;

      await planningAPI.create(payload);
      setForm({
        name: '',
        amount: '',
        type: form.type,
        dayOfMonth: 1,
        monthsDuration: '',
        startDate: currentMonthInput(),
      });
      await load();
      toast.success('Item adicionado ao planejamento.');
    } catch (err) {
      toast.error(err.message, { title: 'Não foi possível adicionar' });
    }
  }

  async function onDelete(item) {
    const ok = await confirm({
      title: 'Excluir item do planejamento?',
      message: `"${item.name}" sairá da projeção.`,
      confirmLabel: 'Excluir',
    });
    if (!ok) return;

    try {
      await planningAPI.delete(item.id);
      load();
      toast.success('Item excluído.');
    } catch (err) {
      toast.error(err.message, { title: 'Não foi possível excluir' });
    }
  }

  function openEdit(item) {
    setEditing({
      id: item.id,
      name: item.name ?? '',
      amount: String(item.amount ?? ''),
      type: item.type ?? 'expense',
      dayOfMonth: item.dayOfMonth ?? 1,
      monthsDuration: item.monthsDuration == null ? '' : String(item.monthsDuration),
      startDate: isoToMonthInput(item.startDate) || currentMonthInput(),
    });
  }

  function closeEdit() {
    setEditing(null);
  }

  async function onUpdate(e) {
    e.preventDefault();
    if (!editing) return;
    try {
      const payload = { ...editing };
      if (payload.monthsDuration === '' || payload.monthsDuration == null) {
        delete payload.monthsDuration;
      } else {
        payload.monthsDuration = Number(payload.monthsDuration);
      }
      if (!payload.startDate) delete payload.startDate;
      if (payload.dayOfMonth === '' || payload.dayOfMonth == null) {
        payload.dayOfMonth = 1;
      } else {
        payload.dayOfMonth = Number(payload.dayOfMonth);
      }
      payload.amount = Number(payload.amount);
      delete payload.id;
      await planningAPI.update(editing.id, payload);
      setEditing(null);
      await load();
      toast.success('Item atualizado.');
    } catch (err) {
      toast.error(err.message, { title: 'Não foi possível salvar' });
    }
  }

  if (loading) return <LoadingState label="Carregando planejamento…" />;

  if (loadError) {
    return (
      <div className="pt-6">
        <ErrorState message={loadError} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">
            <CalendarRange className="w-5 h-5" />
          </span>
          Planejamento
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm max-w-2xl">
          Simule receitas e despesas fixas, integre o saldo das contas e visualize a projeção mês a mês com gráfico.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card relative overflow-hidden ring-1 ring-gray-100 dark:ring-gray-700/80 space-y-6">
          <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <div className="relative">
            <h3 className="text-lg font-semibold mb-1 flex items-center gap-2 text-gray-900 dark:text-white">
              <ListChecks className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              Gastos e receitas fixas
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Valores repetem todo mês na projeção.</p>
            <form className="space-y-3" onSubmit={onCreate}>
              <div>
                <label className="label">Nome</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipo</label>
                  <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="expense">Despesa</option>
                    <option value="income">Receita</option>
                  </select>
                </div>
                <div>
                  <label className="label">Dia</label>
                  <input className="input" type="number" min="1" max="31" value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Valor (R$)</label>
                <input className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} type="number" step="0.01" required />
              </div>
              <div>
                <label className="label flex items-center justify-between">
                  <span>Meses</span>
                  <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400">Vazia = vitalícia</span>
                </label>
                <input
                  className="input"
                  value={form.monthsDuration}
                  onChange={(e) => setForm({ ...form, monthsDuration: e.target.value })}
                  type="number"
                  min="1"
                  max="600"
                  placeholder="Ex.: 4"
                />
              </div>
              <div>
                <label className="label" htmlFor="planning-start">
                  Mês de início
                </label>
                <input
                  id="planning-start"
                  className="input"
                  type="month"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  required
                />
                {form.startDate && (
                  <div className="mt-1 text-[11px] text-violet-700 dark:text-violet-300 first-letter:uppercase">
                    {monthInputRangeLabel(form.startDate, form.monthsDuration)}
                  </div>
                )}
              </div>
              <button className="btn btn-primary w-full shadow-sm shadow-primary-600/20" type="submit">
                Adicionar item
              </button>
            </form>
          </div>

          <div className="relative rounded-xl border border-gray-200/90 dark:border-gray-700 bg-gradient-to-br from-slate-50 to-gray-50/80 dark:from-gray-900/60 dark:to-gray-800/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
              <Landmark className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              Base atual das contas
            </div>
            {accounts.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Nenhuma conta cadastrada — o saldo inicial na projeção será só o ajuste manual.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {accounts.slice(0, 4).map((a) => {
                    const isInvestment = a.type === 'investment';
                    return (
                      <span
                        key={a.id}
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border shadow-sm ${
                          isInvestment
                            ? 'bg-violet-50/80 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800/60'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        <span className="truncate max-w-[7rem] text-gray-700 dark:text-gray-200">{a.name}</span>
                        {isInvestment && (
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                            invest.
                          </span>
                        )}
                        <span
                          className={
                            accountValue(a) < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-gray-900 dark:text-gray-100'
                          }
                        >
                          {formatCurrency(accountValue(a))}
                        </span>
                      </span>
                    );
                  })}
                  {accounts.length > 4 && (
                    <span className="text-xs text-gray-500 self-center">+{accounts.length - 4} contas</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-white/80 dark:bg-gray-800/80 p-2.5 border border-gray-100 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400">Em conta</div>
                    <div className="font-bold tabular-nums text-gray-900 dark:text-white mt-0.5">{formatCurrency(cashTotal)}</div>
                  </div>
                  {investedTotal > 0 ? (
                    <div className="rounded-lg bg-violet-50/90 dark:bg-violet-950/35 p-2.5 border border-violet-100 dark:border-violet-900/50">
                      <div className="text-violet-700/80 dark:text-violet-300/90">Investido</div>
                      <div className="font-bold tabular-nums text-violet-700 dark:text-violet-300 mt-0.5">{formatCurrency(investedTotal)}</div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-red-50/90 dark:bg-red-950/35 p-2.5 border border-red-100 dark:border-red-900/50">
                      <div className="text-red-700/80 dark:text-red-300/90">Dívidas (neg.)</div>
                      <div className="font-bold tabular-nums text-red-700 dark:text-red-300 mt-0.5">{formatCurrency(debtsTotal)}</div>
                    </div>
                  )}
                </div>
                {investedTotal > 0 && debtsTotal < 0 && (
                  <div className="rounded-lg bg-red-50/90 dark:bg-red-950/35 p-2.5 border border-red-100 dark:border-red-900/50 text-xs">
                    <div className="text-red-700/80 dark:text-red-300/90">Dívidas (neg.)</div>
                    <div className="font-bold tabular-nums text-red-700 dark:text-red-300 mt-0.5">{formatCurrency(debtsTotal)}</div>
                  </div>
                )}
                {investedTotal > 0 && (
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">
                    O valor investido entra no saldo base: a projeção é de patrimônio, e ele já é seu.
                    Vem das posições da aba Investimentos, com a cotação mais recente.
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="label text-xs">Ajuste manual (R$)</label>
              <input
                className="input"
                value={manualAdjustment}
                onChange={(e) => setManualAdjustment(e.target.value)}
                type="number"
                step="0.01"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <div className="card lg:col-span-2 ring-1 ring-gray-100 dark:ring-gray-700/80 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl p-4 bg-gradient-to-br from-emerald-50 to-green-50/70 dark:from-emerald-950/35 dark:to-green-950/25 border border-emerald-100/90 dark:border-emerald-800/40 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-emerald-800/80 dark:text-emerald-300/90">Receita mensal</div>
                  <div className="text-xl font-bold mt-1 text-emerald-700 dark:text-emerald-300 tabular-nums">{formatCurrency(totals.income)}</div>
                </div>
                <div className="p-2 rounded-lg bg-white/70 dark:bg-gray-800/60 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
            </div>
            <div className="rounded-xl p-4 bg-gradient-to-br from-rose-50 to-red-50/70 dark:from-rose-950/35 dark:to-red-950/25 border border-rose-100 dark:border-rose-900/40 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-rose-800/80 dark:text-rose-300/90">Despesa mensal</div>
                  <div className="text-xl font-bold mt-1 text-rose-700 dark:text-rose-300 tabular-nums">{formatCurrency(totals.expense)}</div>
                </div>
                <div className="p-2 rounded-lg bg-white/70 dark:bg-gray-800/60 text-rose-600 dark:text-rose-400">
                  <TrendingDown className="w-5 h-5" />
                </div>
              </div>
            </div>
            <div className="rounded-xl p-4 bg-gradient-to-br from-sky-50 to-primary-50/70 dark:from-sky-950/30 dark:to-primary-950/30 border border-sky-100 dark:border-sky-800/40 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-sky-800/80 dark:text-sky-300/90">Sobra mensal</div>
                  <div
                    className={`text-xl font-bold mt-1 tabular-nums ${
                      totals.net >= 0 ? 'text-sky-800 dark:text-sky-200' : 'text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {formatCurrency(totals.net)}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-white/70 dark:bg-gray-800/60 text-sky-600 dark:text-sky-400">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="label">Saldo base na projeção</label>
              <div className="input flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-600 font-semibold tabular-nums">
                <PiggyBank className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
                {formatCurrency(baseBalance)}
              </div>
            </div>
            <div className="flex-1">
              <label className="label">Meses à frente</label>
              <div className="flex gap-2">
                <input className="input flex-1" value={monthsAhead} onChange={(e) => setMonthsAhead(e.target.value)} type="number" min="1" max="1200" />
                {[6, 12, 24].map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="btn btn-secondary px-3 text-xs shrink-0"
                    onClick={() => setMonthsAhead(m)}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="rounded-xl border border-gray-200/90 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">
                <LineChart className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                Evolução do saldo projetado
              </div>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="planningBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-gray-500" />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : `${v}`)} width={44} />
                    <Tooltip
                      formatter={(value) => formatCurrency(value)}
                      labelFormatter={(label) => `Período: ${label}`}
                      contentStyle={{
                        borderRadius: '0.75rem',
                        border: '1px solid rgb(229 231 235)',
                        background: 'rgba(255,255,255,0.95)',
                      }}
                    />
                    <Area type="monotone" dataKey="saldo" name="Saldo" stroke="#0284c7" strokeWidth={2} fill="url(#planningBalance)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Clique em uma linha para ver os itens do mês.
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200/90 dark:border-gray-700 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-100/90 dark:bg-gray-800/95 text-gray-700 dark:text-gray-200 text-xs uppercase tracking-wide">
                    <th className="text-left p-3.5 font-semibold w-10" aria-label="Expandir" />
                    <th className="text-left p-3.5 font-semibold">Mês</th>
                    <th className="text-right p-3.5 font-semibold">Receitas</th>
                    <th className="text-right p-3.5 font-semibold">Despesas</th>
                    <th className="text-right p-3.5 font-semibold">Sobra</th>
                    <th className="text-right p-3.5 font-semibold">Saldo projetado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/80 bg-white dark:bg-gray-900/50">
                  {projection.map((r, idx) => {
                    const isOpen = expandedMonth === r.key;
                    return (
                      <FragmentRow
                        key={r.key}
                        row={r}
                        idx={idx}
                        isOpen={isOpen}
                        onToggle={() => toggleMonth(r.key)}
                        items={items}
                        isItemActiveInMonth={isItemActiveInMonth}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
              <ListChecks className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              Itens cadastrados
            </h3>
            <div className="space-y-2">
              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 py-10 text-center text-gray-500 dark:text-gray-400 text-sm">
                  Nenhum item ainda. Adicione despesas ou receitas fixas ao lado.
                </div>
              ) : (
                items.map((i) => (
                  <div
                    key={i.id}
                    className={`flex items-center justify-between gap-3 p-4 rounded-xl border shadow-sm transition-transform hover:scale-[1.01] ${
                      i.type === 'income'
                        ? 'bg-gradient-to-r from-emerald-50/90 to-white dark:from-emerald-950/30 dark:to-gray-800/80 border-emerald-100 dark:border-emerald-900/40'
                        : 'bg-gradient-to-r from-rose-50/90 to-white dark:from-rose-950/30 dark:to-gray-800/80 border-rose-100 dark:border-rose-900/40'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`mt-0.5 p-2 rounded-lg shrink-0 ${
                          i.type === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-rose-100 dark:bg-rose-900/40'
                        }`}
                      >
                        {i.type === 'income' ? (
                          <ArrowUpCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <ArrowDownCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-white truncate">{i.name}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span>{i.type === 'income' ? 'Receita' : 'Despesa'} • dia {i.dayOfMonth}</span>
                          <ItemPeriodBadges item={i} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`font-bold tabular-nums ${i.type === 'income' ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                        {formatCurrency(i.amount)}
                      </span>
                      <button type="button" className="btn btn-secondary px-3 py-1.5 text-sm inline-flex items-center gap-1" onClick={() => openEdit(i)}>
                        <Pencil className="w-3.5 h-3.5" />
                        Editar
                      </button>
                      <button type="button" className="btn btn-danger px-3 py-1.5 text-sm inline-flex items-center gap-1" onClick={() => onDelete(i)}>
                        <Trash2 className="w-3.5 h-3.5" />
                        Excluir
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm" onClick={closeEdit}>
          <div
            className="card w-full max-w-lg shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                Editar item
              </h3>
              <button
                type="button"
                onClick={closeEdit}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form className="space-y-3" onSubmit={onUpdate}>
              <div>
                <label className="label">Nome</label>
                <input
                  className="input"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipo</label>
                  <select
                    className="select"
                    value={editing.type}
                    onChange={(e) => setEditing({ ...editing, type: e.target.value })}
                  >
                    <option value="expense">Despesa</option>
                    <option value="income">Receita</option>
                  </select>
                </div>
                <div>
                  <label className="label">Dia</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    max="31"
                    value={editing.dayOfMonth}
                    onChange={(e) => setEditing({ ...editing, dayOfMonth: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label">Valor (R$)</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={editing.amount}
                  onChange={(e) => setEditing({ ...editing, amount: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label flex items-center justify-between">
                  <span>Meses</span>
                  <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400">Vazia = vitalícia</span>
                </label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="600"
                  value={editing.monthsDuration}
                  onChange={(e) => setEditing({ ...editing, monthsDuration: e.target.value })}
                  placeholder="Ex.: 4"
                />
              </div>
              <div>
                <label className="label" htmlFor="planning-edit-start">
                  Mês de início
                </label>
                <input
                  id="planning-edit-start"
                  className="input"
                  type="month"
                  value={editing.startDate}
                  onChange={(e) => setEditing({ ...editing, startDate: e.target.value })}
                  required
                />
                {editing.startDate && (
                  <div className="mt-1 text-[11px] text-violet-700 dark:text-violet-300 first-letter:uppercase">
                    {monthInputRangeLabel(editing.startDate, editing.monthsDuration)}
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" className="btn btn-secondary flex-1" onClick={closeEdit}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1 shadow-sm shadow-primary-600/20">
                  Salvar alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
