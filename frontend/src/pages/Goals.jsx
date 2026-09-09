import { useEffect, useMemo, useState } from 'react';
import {
  Target,
  Wallet,
  CalendarDays,
  CheckCircle2,
  Clock,
  Trash2,
  Info,
  PiggyBank,
  TrendingUp,
} from 'lucide-react';
import { goalsAPI } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import { ErrorState, LoadingState } from '../components/ui/StateMessage.jsx';

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/**
 * Rótulo do mês derivado da data de pagamento. Vem daqui, e não do `monthLabel`
 * gravado no banco, para que metas criadas antes da correção também mostrem o ano.
 */
function formatMonthLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function formatPaymentDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function normalizeInstallmentStatus(status) {
  if (status === 'Ok' || status === 'OK' || status === 'Pago') return 'Ok';
  return 'Pendente';
}

const ROW_LIMIT_OPTIONS = [
  { value: '6', label: '6 linhas' },
  { value: '12', label: '12 linhas' },
  { value: '24', label: '24 linhas' },
  { value: 'all', label: 'Todas' },
];

function limitToNumber(key) {
  if (key === 'all') return Number.POSITIVE_INFINITY;
  return Number.parseInt(key, 10) || 6;
}

export default function Goals() {
  const toast = useToast();
  const confirm = useConfirm();
  const [loadError, setLoadError] = useState(null);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [scheduleTab, setScheduleTab] = useState('pendentes');
  const [rowLimit, setRowLimit] = useState('6');

  const [form, setForm] = useState({
    name: '',
    years: '',
    monthlyRatePct: '',
    targetFinalValue: '',
    startDate: new Date().toISOString().slice(0, 10),
  });

  async function load() {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await goalsAPI.list();
      setGoals(data);
      if (!selectedGoalId && data?.[0]?.id) setSelectedGoalId(data[0].id);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedGoal = goals.find((g) => g.id === selectedGoalId) || null;

  const schedule = useMemo(() => selectedGoal?.installments || [], [selectedGoal]);

  const pendingRows = useMemo(
    () => schedule.filter((r) => normalizeInstallmentStatus(r.status) === 'Pendente'),
    [schedule],
  );

  const paidRows = useMemo(
    () => schedule.filter((r) => normalizeInstallmentStatus(r.status) === 'Ok'),
    [schedule],
  );

  const progressPct = useMemo(() => {
    if (!schedule.length) return 0;
    return Math.round((paidRows.length / schedule.length) * 100);
  }, [schedule.length, paidRows.length]);

  const activeRows = scheduleTab === 'pendentes' ? pendingRows : paidRows;

  const displaySlice = useMemo(() => {
    const limit = limitToNumber(rowLimit);
    const total = activeRows.length;
    if (!Number.isFinite(limit) || total <= limit) {
      return { head: activeRows, hiddenAfter: 0 };
    }
    return {
      head: activeRows.slice(0, limit),
      hiddenAfter: total - limit,
    };
  }, [activeRows, rowLimit]);

  async function onCreate(e) {
    e.preventDefault();
    try {
      const created = await goalsAPI.create({
        name: form.name,
        years: form.years,
        monthlyRatePct: form.monthlyRatePct,
        targetFinalValue: form.targetFinalValue,
        startDate: form.startDate,
      });
      await load();
      setSelectedGoalId(created.id);
      setForm((f) => ({ ...f, name: '' }));
      toast.success(`Meta "${created.name}" criada com ${created.years * 12} parcelas.`);
    } catch (err) {
      toast.error(err.message, { title: 'Não foi possível criar a meta' });
    }
  }

  async function updateInstallment(row, data) {
    try {
      await goalsAPI.updateInstallment(row.id, data);
      await load();
    } catch (err) {
      toast.error(err.message, { title: 'Não foi possível atualizar a parcela' });
    }
  }

  async function onDelete(goal) {
    const ok = await confirm({
      title: 'Excluir meta?',
      message: `"${goal.name}" e todas as suas parcelas serão removidas.`,
      confirmLabel: 'Excluir meta',
    });
    if (!ok) return;

    try {
      await goalsAPI.delete(goal.id);
      setSelectedGoalId('');
      load();
      toast.success('Meta excluída.');
    } catch (err) {
      toast.error(err.message, { title: 'Não foi possível excluir' });
    }
  }

  function renderTotalRowPendentes() {
    if (!selectedGoal || !schedule.length) return null;
    const last = schedule[schedule.length - 1];
    return (
      <tr className="border-t-2 border-primary-200 dark:border-primary-800 bg-gradient-to-r from-primary-50/90 to-indigo-50/80 dark:from-primary-950/50 dark:to-indigo-950/40 font-semibold">
        <td className="p-3 text-primary-900 dark:text-primary-100">
          <span className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 shrink-0 text-primary-600 dark:text-primary-400" />
            Total ({selectedGoal.years} anos)
          </span>
        </td>
        <td className="p-3 text-gray-500 dark:text-gray-400">—</td>
        <td className="p-3 text-right tabular-nums text-gray-900 dark:text-white">{formatCurrency(selectedGoal.monthlyContribution)}</td>
        <td className="p-3 text-right tabular-nums">{selectedGoal.monthlyRatePct.toFixed(2)}</td>
        <td className="p-3 text-right tabular-nums text-gray-900 dark:text-white">{formatCurrency(selectedGoal.monthlyContribution * selectedGoal.years * 12)}</td>
        <td className="p-3 text-right tabular-nums text-primary-700 dark:text-primary-300">{formatCurrency(last.projectedBalance)}</td>
        <td className="p-3 text-gray-500 dark:text-gray-400">—</td>
        <td className="p-3 text-right tabular-nums">{selectedGoal.years * 12}</td>
      </tr>
    );
  }

  function renderResumoPagos() {
    if (!paidRows.length) return null;
    const sorted = [...paidRows].sort((a, b) => a.monthIndex - b.monthIndex);
    const lastPaid = sorted[sorted.length - 1];
    const sumContrib = sorted.reduce((s, r) => s + r.contribution, 0);
    return (
      <tr className="border-t-2 border-emerald-300 dark:border-emerald-700 bg-gradient-to-r from-emerald-50 to-teal-50/80 dark:from-emerald-950/40 dark:to-teal-950/30 font-semibold">
        <td className="p-3 text-emerald-900 dark:text-emerald-100">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            Resumo (pagos)
          </span>
        </td>
        <td className="p-3 text-gray-500 dark:text-gray-400">—</td>
        <td className="p-3 text-right tabular-nums">{formatCurrency(sumContrib / sorted.length)}</td>
        <td className="p-3 text-right tabular-nums">{selectedGoal.monthlyRatePct.toFixed(2)}</td>
        <td className="p-3 text-right tabular-nums text-emerald-800 dark:text-emerald-200">{formatCurrency(sumContrib)}</td>
        <td className="p-3 text-right tabular-nums text-emerald-700 dark:text-emerald-300">{formatCurrency(lastPaid.projectedBalance)}</td>
        <td className="p-3 text-gray-500 dark:text-gray-400">—</td>
        <td className="p-3 text-right tabular-nums">{sorted.length}</td>
      </tr>
    );
  }

  const rowAccentClass =
    scheduleTab === 'pendentes'
      ? 'bg-amber-50/70 dark:bg-amber-950/25 hover:bg-amber-50 dark:hover:bg-amber-950/35 border-l-4 border-amber-400 dark:border-amber-500'
      : 'bg-emerald-50/70 dark:bg-emerald-950/25 hover:bg-emerald-50 dark:hover:bg-emerald-950/35 border-l-4 border-emerald-500 dark:border-emerald-500';

  if (loading) return <LoadingState label="Carregando metas…" />;

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
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400">
            <Target className="w-5 h-5" />
          </span>
          Metas
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm max-w-2xl">
          Projete aportes mensais, acompanhe parcelas pendentes (destaque em âmbar) e pagas (verde), alinhado ao restante do app.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card relative overflow-hidden ring-1 ring-gray-100 dark:ring-gray-700/80">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <h3 className="text-lg font-semibold mb-1 flex items-center gap-2 text-gray-900 dark:text-white">
            <PiggyBank className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            Nova meta
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Preencha os dados para gerar o cronograma automaticamente.</p>
          <form className="space-y-3 relative" onSubmit={onCreate}>
            <div>
              <label className="label">Nome</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Aposentadoria" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Prazo (anos)</label>
                <input className="input" value={form.years} onChange={(e) => setForm({ ...form, years: e.target.value })} type="number" min="1" required />
              </div>
              <div>
                <label className="label">Juros (% a.m.)</label>
                <input className="input" value={form.monthlyRatePct} onChange={(e) => setForm({ ...form, monthlyRatePct: e.target.value })} placeholder="0,95" required />
              </div>
            </div>
            <div>
              <label className="label">Data Início</label>
              <input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
            </div>
            <div>
              <label className="label">Valor final alvo (R$)</label>
              <input className="input" value={form.targetFinalValue} onChange={(e) => setForm({ ...form, targetFinalValue: e.target.value })} placeholder="927.036,59" required />
            </div>
            <button className="btn btn-primary w-full shadow-sm shadow-primary-600/20" type="submit">
              Criar meta
            </button>
          </form>
        </div>

        <div className="card lg:col-span-2 ring-1 ring-gray-100 dark:ring-gray-700/80 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-end sm:justify-between">
            <div className="flex-1 w-full">
              <label className="label">Meta selecionada</label>
              <select className="select font-medium" value={selectedGoalId} onChange={(e) => setSelectedGoalId(e.target.value)}>
                <option value="">Selecione…</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.years} anos)
                  </option>
                ))}
              </select>
            </div>
            {selectedGoal && (
              <button
                type="button"
                className="btn btn-danger inline-flex items-center justify-center gap-2 shrink-0"
                onClick={() => onDelete(selectedGoal)}
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </button>
            )}
          </div>

          {selectedGoal ? (
            <div className="space-y-5">
              {schedule.length > 0 && (
                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    <span>Progresso das parcelas</span>
                    <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{progressPct}% pagas</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-amber-200/70 dark:bg-amber-900/50 overflow-hidden ring-1 ring-inset ring-amber-300/30 dark:ring-amber-800/30">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 ease-out shadow-sm"
                      style={{ width: `${progressPct}%`, minWidth: progressPct > 0 ? '4px' : 0 }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {paidRows.length} de {schedule.length} parcelas concluídas
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl p-4 bg-gradient-to-br from-primary-50 to-sky-50/80 dark:from-primary-950/40 dark:to-sky-950/30 border border-primary-100/80 dark:border-primary-800/50 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-primary-700/80 dark:text-primary-300/90">Aporte mensal</div>
                      <div className="text-lg sm:text-xl font-bold mt-1 text-gray-900 dark:text-white tabular-nums">{formatCurrency(selectedGoal.monthlyContribution)}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white/70 dark:bg-gray-800/60 text-primary-600 dark:text-primary-400">
                      <Wallet className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-xs text-primary-700/70 dark:text-primary-300/60 mt-2">Sugestão para atingir o alvo</p>
                </div>
                <div className="rounded-xl p-4 bg-gradient-to-br from-violet-50 to-indigo-50/70 dark:from-violet-950/35 dark:to-indigo-950/30 border border-violet-100 dark:border-violet-800/40 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-violet-700/80 dark:text-violet-300/90">Prazo</div>
                      <div className="text-lg sm:text-xl font-bold mt-1 text-gray-900 dark:text-white">{selectedGoal.years * 12} meses</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white/70 dark:bg-gray-800/60 text-violet-600 dark:text-violet-300">
                      <CalendarDays className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-xs text-violet-700/70 dark:text-violet-300/60 mt-2">{selectedGoal.years} anos no total</p>
                </div>
                <div className="rounded-xl p-4 bg-gradient-to-br from-emerald-50 to-teal-50/70 dark:from-emerald-950/35 dark:to-teal-950/30 border border-emerald-100 dark:border-emerald-800/40 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-emerald-800/80 dark:text-emerald-300/90">Alvo final</div>
                      <div className="text-lg sm:text-xl font-bold mt-1 text-emerald-800 dark:text-emerald-200 tabular-nums">{formatCurrency(selectedGoal.targetFinalValue)}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white/70 dark:bg-gray-800/60 text-emerald-600 dark:text-emerald-400">
                      <Target className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-xs text-emerald-800/70 dark:text-emerald-300/60 mt-2">Com juros compostos mensais</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="inline-flex rounded-xl p-1 bg-gray-100 dark:bg-gray-900/80 ring-1 ring-gray-200/80 dark:ring-gray-700 w-fit">
                  <button
                    type="button"
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      scheduleTab === 'pendentes'
                        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25'
                        : 'text-gray-600 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400'
                    }`}
                    onClick={() => setScheduleTab('pendentes')}
                  >
                    <Clock className="w-4 h-4" />
                    Pendentes
                    <span
                      className={`ml-1 tabular-nums text-xs px-2 py-0.5 rounded-full ${
                        scheduleTab === 'pendentes' ? 'bg-white/25 text-white' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200'
                      }`}
                    >
                      {pendingRows.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      scheduleTab === 'pagos'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                        : 'text-gray-600 dark:text-gray-400 hover:text-emerald-700 dark:hover:text-emerald-400'
                    }`}
                    onClick={() => setScheduleTab('pagos')}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Pagos
                    <span
                      className={`ml-1 tabular-nums text-xs px-2 py-0.5 rounded-full ${
                        scheduleTab === 'pagos' ? 'bg-white/25 text-white' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200'
                      }`}
                    >
                      {paidRows.length}
                    </span>
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">Mostrar</label>
                  <select
                    className="select w-auto min-w-[9rem] font-medium bg-white dark:bg-gray-800"
                    value={rowLimit}
                    onChange={(e) => setRowLimit(e.target.value)}
                  >
                    {ROW_LIMIT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {activeRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/40 px-6 py-10 text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-gray-200/80 dark:bg-gray-700 flex items-center justify-center mb-3">
                    {scheduleTab === 'pendentes' ? (
                      <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 font-medium">
                    {scheduleTab === 'pendentes' ? 'Nenhuma parcela pendente' : 'Nenhuma parcela paga ainda'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {scheduleTab === 'pendentes'
                      ? 'Todas as parcelas foram marcadas como Ok ou a meta ainda não tem cronograma.'
                      : 'Marque parcelas como Ok na aba Pendentes para vê-las aqui.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200/90 dark:border-gray-700 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100/90 dark:bg-gray-800/95 text-gray-700 dark:text-gray-200 text-xs uppercase tracking-wide">
                          <th className="text-left p-3.5 font-semibold">Mês</th>
                          <th className="text-left p-3.5 font-semibold">Pagamento</th>
                          <th className="text-right p-3.5 font-semibold">Valor investido</th>
                          <th className="text-right p-3.5 font-semibold">Juros (%)</th>
                          <th className="text-right p-3.5 font-semibold">Acumulado</th>
                          <th className="text-right p-3.5 font-semibold">Saldo final</th>
                          <th className="text-left p-3.5 font-semibold">Status</th>
                          <th className="text-right p-3.5 font-semibold">Mês #</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/80 bg-white dark:bg-gray-900/50">
                        {displaySlice.head.map((row) => (
                          <tr key={row.id || row.monthIndex} className={`transition-colors ${rowAccentClass}`}>
                            <td className="p-3.5 first-letter:uppercase font-medium text-gray-900 dark:text-gray-100">{formatMonthLabel(row.paymentDate)}</td>
                            <td className="p-3.5 text-gray-700 dark:text-gray-300 tabular-nums">{formatPaymentDate(row.paymentDate)}</td>
                            <td className="p-3.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(row.contribution)}</td>
                            <td className="p-3.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{row.ratePct.toFixed(2)}</td>
                            <td className="p-3.5 text-right tabular-nums text-gray-800 dark:text-gray-200">{formatCurrency(row.investedTotal)}</td>
                            <td className="p-3.5 text-right tabular-nums font-semibold text-gray-900 dark:text-white">{formatCurrency(row.projectedBalance)}</td>
                            <td className="p-3.5">
                              <select
                                className={`select py-1.5 text-xs font-semibold max-w-[9.5rem] ${
                                  normalizeInstallmentStatus(row.status) === 'Ok'
                                    ? 'border-emerald-300 dark:border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100'
                                    : 'border-amber-300 dark:border-amber-600 bg-amber-50/80 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100'
                                }`}
                                value={normalizeInstallmentStatus(row.status)}
                                onChange={(e) => updateInstallment(row, { status: e.target.value })}
                              >
                                <option value="Pendente">Pendente</option>
                                <option value="Ok">Ok</option>
                              </select>
                            </td>
                            <td className="p-3.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{row.monthIndex}</td>
                          </tr>
                        ))}
                        {displaySlice.hiddenAfter > 0 && (
                          <tr className="bg-gray-50/90 dark:bg-gray-800/40">
                            <td colSpan={8} className="p-4 text-center text-sm text-gray-600 dark:text-gray-400">
                              <span className="inline-flex items-center gap-2">
                                … e mais <strong className="text-gray-800 dark:text-gray-200">{displaySlice.hiddenAfter}</strong> parcela
                                {displaySlice.hiddenAfter !== 1 ? 's' : ''} — aumente &quot;Mostrar&quot; para ver tudo
                              </span>
                            </td>
                          </tr>
                        )}
                        {scheduleTab === 'pendentes' ? renderTotalRowPendentes() : renderResumoPagos()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-3 rounded-lg bg-blue-50/90 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 px-4 py-3 text-xs text-blue-900 dark:text-blue-200">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                <p>
                  A data de pagamento vem da data de início e não pode ser alterada. O rodapé da tabela traz a projeção final com juros compostos mensais.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 py-14 text-center text-gray-500 dark:text-gray-400">
              <Target className="w-10 h-10 mx-auto mb-3 opacity-50" />
              Crie ou selecione uma meta para ver a projeção.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
