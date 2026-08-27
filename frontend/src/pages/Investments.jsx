import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Plus, RefreshCw, Briefcase, BarChart3,
  Coins, Target, History, Trash2, Edit3, ArrowLeft,
} from 'lucide-react';
import {
  investmentsAPI, investmentGoalsAPI, investmentTransactionsAPI, marketAPI,
} from '../services/api.js';
import AssetCard from '../components/investments/AssetCard.jsx';
import AllocationPieChart from '../components/investments/AllocationPieChart.jsx';
import PortfolioChart from '../components/investments/PortfolioChart.jsx';
import DividendsChart from '../components/investments/DividendsChart.jsx';
import GoalProgressCard from '../components/investments/GoalProgressCard.jsx';
import IndexComparisonChart from '../components/investments/IndexComparisonChart.jsx';
import InvestmentFormModal from '../components/investments/InvestmentFormModal.jsx';
import TransactionFormModal from '../components/investments/TransactionFormModal.jsx';
import GoalFormModal from '../components/investments/GoalFormModal.jsx';

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatContractedRate(indexer, rate) {
  if (rate == null || rate === '') return null;
  const n = Number(rate);
  if (Number.isNaN(n)) return null;
  const formatted = n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (indexer === 'IPCA') return `IPCA+${formatted}`;
  if (indexer === 'IGPM') return `IGP-M+${formatted}`;
  if (indexer === 'SELIC') return `Selic+${formatted}`;
  if (indexer === 'PRE') return `${formatted}% a.a.`;
  if (indexer === 'CDI') return `${formatted}% do CDI`;
  return `${formatted}%`;
}

const TABS = [
  { key: 'carteira', label: 'Carteira', icon: Briefcase },
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'proventos', label: 'Proventos', icon: Coins },
  { key: 'metas', label: 'Metas', icon: Target },
  { key: 'historico', label: 'Histórico', icon: History },
];

const TX_TYPE_LABELS = {
  APORTE: 'Aporte', RESGATE: 'Resgate', DIVIDENDO: 'Dividendo', JCP: 'JCP',
  RENDIMENTO: 'Rendimento', BONIFICACAO: 'Bonificação', DESDOBRAMENTO: 'Desdobramento', GRUPAMENTO: 'Grupamento',
};

export default function Investments() {
  const [activeTab, setActiveTab] = useState('carteira');
  const [investments, setInvestments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [allocation, setAllocation] = useState(null);
  const [evolution, setEvolution] = useState(null);
  const [dividends, setDividends] = useState(null);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dividendYear, setDividendYear] = useState(new Date().getFullYear());

  // Modais
  const [showInvestmentModal, setShowInvestmentModal] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionTarget, setTransactionTarget] = useState(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);

  // Detail view
  const [selectedInvestment, setSelectedInvestment] = useState(null);
  const [detailTransactions, setDetailTransactions] = useState([]);

  const loadInvestments = useCallback(async ({ autoRefreshTreasury = false } = {}) => {
    try {
      const data = await investmentsAPI.getAll();
      setInvestments(data);

      const needsTreasuryRefresh = autoRefreshTreasury && data.some(
        (inv) => inv.assetType === 'TESOURO_DIRETO' && !inv.currentPrice
      );
      if (needsTreasuryRefresh) {
        await marketAPI.refreshAll();
        const refreshed = await investmentsAPI.getAll();
        setInvestments(refreshed);
      }
    } catch (err) {
      console.error('Erro ao carregar investimentos:', err);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const data = await investmentsAPI.getSummary();
      setSummary(data);
    } catch (err) {
      console.error('Erro ao carregar resumo:', err);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await loadInvestments({ autoRefreshTreasury: true });
      await loadSummary();
    } finally {
      setLoading(false);
    }
  }, [loadInvestments, loadSummary]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Carregar dados da aba quando mudar
  useEffect(() => {
    if (activeTab === 'dashboard') {
      investmentsAPI.getAllocation().then(setAllocation).catch(() => {});
      investmentsAPI.getEvolution(12).then(setEvolution).catch(() => {});
    } else if (activeTab === 'proventos') {
      investmentsAPI.getDividends(dividendYear).then(setDividends).catch(() => {});
    } else if (activeTab === 'metas') {
      investmentGoalsAPI.getAll().then(setGoals).catch(() => {});
    }
  }, [activeTab, dividendYear]);

  // Detail view
  useEffect(() => {
    if (selectedInvestment) {
      investmentsAPI.getTransactions(selectedInvestment.id).then(setDetailTransactions).catch(() => {});
    }
  }, [selectedInvestment]);

  async function handleRefreshAll() {
    setRefreshing(true);
    try {
      await marketAPI.refreshAll();
      await loadAll();
    } catch (err) {
      alert('Erro ao atualizar cotações: ' + err.message);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRefreshPrice(investmentId) {
    try {
      await investmentsAPI.refreshPrice(investmentId);
      await loadInvestments();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleSaveInvestment(data) {
    if (editingInvestment) {
      await investmentsAPI.update(editingInvestment.id, data);
    } else {
      await investmentsAPI.create(data);
    }
    await loadAll();
    setEditingInvestment(null);
  }

  async function handleDeleteInvestment(id) {
    if (!confirm('Excluir este investimento e todas as transações?')) return;
    await investmentsAPI.delete(id);
    setSelectedInvestment(null);
    await loadAll();
  }

  async function handleSaveTransaction(data) {
    if (!transactionTarget) return;
    await investmentsAPI.createTransaction(transactionTarget.id, data);
    await loadAll();
    if (selectedInvestment?.id === transactionTarget.id) {
      const txs = await investmentsAPI.getTransactions(transactionTarget.id);
      setDetailTransactions(txs);
      const inv = await investmentsAPI.getById(transactionTarget.id);
      setSelectedInvestment(inv);
    }
  }

  async function handleDeleteTransaction(txId) {
    if (!confirm('Excluir esta transação?')) return;
    await investmentTransactionsAPI.delete(txId);
    await loadAll();
    if (selectedInvestment) {
      const txs = await investmentsAPI.getTransactions(selectedInvestment.id);
      setDetailTransactions(txs);
      const inv = await investmentsAPI.getById(selectedInvestment.id);
      setSelectedInvestment(inv);
    }
  }

  async function handleSaveGoal(data) {
    if (editingGoal) {
      await investmentGoalsAPI.update(editingGoal.id, data);
    } else {
      await investmentGoalsAPI.create(data);
    }
    const goalsData = await investmentGoalsAPI.getAll();
    setGoals(goalsData);
    setEditingGoal(null);
  }

  async function handleDeleteGoal(id) {
    if (!confirm('Excluir esta meta?')) return;
    await investmentGoalsAPI.delete(id);
    const goalsData = await investmentGoalsAPI.getAll();
    setGoals(goalsData);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="h-10 w-10 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">Carregando investimentos...</p>
      </div>
    );
  }

  // Detail view de um investimento
  if (selectedInvestment) {
    const inv = selectedInvestment;
    const isProfit = (inv.absoluteGain || 0) >= 0;

    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setSelectedInvestment(null)}
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <ArrowLeft size={16} /> Voltar
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{inv.name}</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {inv.ticker && <span className="font-mono font-bold mr-2">{inv.ticker}</span>}
              {inv.broker && <span>{inv.broker}</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 inline-flex items-center gap-2"
              onClick={() => { setEditingInvestment(inv); setShowInvestmentModal(true); }}
            >
              <Edit3 size={16} /> Editar
            </button>
            <button
              type="button"
              className="btn btn-primary inline-flex items-center gap-2"
              onClick={() => { setTransactionTarget(inv); setShowTransactionModal(true); }}
            >
              <Plus size={16} /> Transação
            </button>
            <button
              type="button"
              className="btn btn-danger inline-flex items-center gap-2"
              onClick={() => handleDeleteInvestment(inv.id)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card bg-blue-50 dark:bg-blue-900/20">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Valor Investido</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
              {formatCurrency(Number(inv.quantity) * Number(inv.averagePrice))}
            </p>
          </div>
          <div className="card bg-violet-50 dark:bg-violet-900/20">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Valor Atual</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
              {formatCurrency(inv.currentValue || 0)}
            </p>
          </div>
          <div className={`card ${isProfit ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Ganho/Perda</p>
            <p className={`text-lg font-bold tabular-nums ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
              {(inv.absoluteGain || 0) >= 0 ? '+' : ''}{formatCurrency(inv.absoluteGain || 0)}
            </p>
          </div>
          <div className={`card ${isProfit ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Rentabilidade</p>
            <p className={`text-lg font-bold tabular-nums ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
              {(inv.percentageGain || 0) >= 0 ? '+' : ''}{(inv.percentageGain || 0).toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="card">
            <p className="text-xs text-gray-500 dark:text-gray-400">Quantidade</p>
            <p className="font-semibold text-gray-900 dark:text-white tabular-nums">{Number(inv.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 8 })}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500 dark:text-gray-400">Preço Médio</p>
            <p className="font-semibold text-gray-900 dark:text-white tabular-nums">{formatCurrency(inv.averagePrice)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500 dark:text-gray-400">Preço Atual</p>
            <p className="font-semibold text-gray-900 dark:text-white tabular-nums">{inv.currentPrice ? formatCurrency(inv.currentPrice) : '—'}</p>
          </div>
          {['TESOURO_DIRETO', 'RENDA_FIXA'].includes(inv.assetType) && (
            <div className="card">
              <p className="text-xs text-gray-500 dark:text-gray-400">Taxa contratada</p>
              <p className="font-semibold text-gray-900 dark:text-white tabular-nums">
                {formatContractedRate(inv.indexer, inv.interestRate) || '—'}
              </p>
            </div>
          )}
          <div className="card">
            <p className="text-xs text-gray-500 dark:text-gray-400">Última Atualização</p>
            <p className="font-semibold text-gray-900 dark:text-white text-sm">
              {inv.lastPriceUpdate ? new Date(inv.lastPriceUpdate).toLocaleDateString('pt-BR') : '—'}
            </p>
          </div>
        </div>

        {/* Transações */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Transações</h3>
          {detailTransactions.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Nenhuma transação registrada</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs uppercase">
                    <th className="text-left p-3">Data</th>
                    <th className="text-left p-3">Tipo</th>
                    <th className="text-right p-3">Qtd</th>
                    <th className="text-right p-3">Preço</th>
                    <th className="text-right p-3">Taxa</th>
                    <th className="text-right p-3">Total</th>
                    <th className="text-right p-3">Taxas</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {detailTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-3 tabular-nums">{new Date(tx.transactionDate).toLocaleDateString('pt-BR')}</td>
                      <td className="p-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          tx.type === 'APORTE' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                          : tx.type === 'RESGATE' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                          : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                        }`}>
                          {TX_TYPE_LABELS[tx.type] || tx.type}
                        </span>
                      </td>
                      <td className="p-3 text-right tabular-nums">{Number(tx.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 8 })}</td>
                      <td className="p-3 text-right tabular-nums">{formatCurrency(tx.unitPrice)}</td>
                      <td className="p-3 text-right tabular-nums">
                        {tx.interestRate != null
                          ? formatContractedRate(inv.indexer, tx.interestRate)
                          : '—'}
                      </td>
                      <td className="p-3 text-right tabular-nums font-semibold">{formatCurrency(tx.totalAmount)}</td>
                      <td className="p-3 text-right tabular-nums text-gray-400">{Number(tx.fees) > 0 ? formatCurrency(tx.fees) : '—'}</td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="p-1 text-gray-400 hover:text-red-500"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <TransactionFormModal
          isOpen={showTransactionModal}
          onClose={() => setShowTransactionModal(false)}
          onSave={handleSaveTransaction}
          investment={transactionTarget}
        />
        <InvestmentFormModal
          isOpen={showInvestmentModal}
          onClose={() => { setShowInvestmentModal(false); setEditingInvestment(null); }}
          onSave={handleSaveInvestment}
          investment={editingInvestment}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400">
              <TrendingUp className="w-5 h-5" />
            </span>
            Investimentos
          </h2>
          {summary && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Patrimônio: <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(summary.totalCurrent)}</span>
              <span className={`ml-2 font-semibold ${summary.totalGain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                ({summary.totalGain >= 0 ? '+' : ''}{summary.totalGainPct.toFixed(2)}%)
              </span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="btn bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 inline-flex items-center gap-2"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Atualizando...' : 'Atualizar cotações'}
          </button>
          <button
            type="button"
            onClick={() => { setEditingInvestment(null); setShowInvestmentModal(true); }}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} /> Novo ativo
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card bg-blue-50 dark:bg-blue-900/20 border border-transparent">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Investido</p>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300 tabular-nums mt-0.5">{formatCurrency(summary.totalInvested)}</p>
          </div>
          <div className="card bg-violet-50 dark:bg-violet-900/20 border border-transparent">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Valor Atual</p>
            <p className="text-xl font-bold text-violet-700 dark:text-violet-300 tabular-nums mt-0.5">{formatCurrency(summary.totalCurrent)}</p>
          </div>
          <div className={`card ${summary.totalGain >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'} border border-transparent`}>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ganho/Perda</p>
            <p className={`text-xl font-bold tabular-nums mt-0.5 ${summary.totalGain >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'}`}>
              {summary.totalGain >= 0 ? '+' : ''}{formatCurrency(summary.totalGain)}
            </p>
          </div>
          <div className="card bg-gray-50 dark:bg-gray-800 border border-transparent">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ativos</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{summary.totalAssets}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1 overflow-x-auto pb-px">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'carteira' && (
        <div>
          {investments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 py-14 text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="font-medium text-gray-500 dark:text-gray-400">Você ainda não tem investimentos cadastrados</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 mb-4">Adicione seu primeiro ativo para começar</p>
              <button
                type="button"
                onClick={() => setShowInvestmentModal(true)}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <Plus size={16} /> Adicionar o primeiro
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {investments.map((inv) => (
                <AssetCard
                  key={inv.id}
                  investment={inv}
                  onSelect={(inv) => {
                    investmentsAPI.getById(inv.id).then(setSelectedInvestment).catch(() => setSelectedInvestment(inv));
                  }}
                  onRefreshPrice={handleRefreshPrice}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <AllocationPieChart data={allocation?.byType} title="Alocação por Tipo" />
          </div>
          <div className="card">
            <AllocationPieChart data={allocation?.byBroker} title="Alocação por Corretora" />
          </div>
          <div className="card lg:col-span-2">
            <PortfolioChart data={evolution?.evolution} />
          </div>
          <div className="card lg:col-span-2">
            <IndexComparisonChart data={[]} />
          </div>
        </div>
      )}

      {activeTab === 'proventos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Proventos</h3>
            <select
              className="select w-auto"
              value={dividendYear}
              onChange={(e) => setDividendYear(parseInt(e.target.value))}
            >
              {[...Array(5)].map((_, i) => {
                const y = new Date().getFullYear() - i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
          </div>
          {dividends && (
            <>
              <div className="card bg-emerald-50 dark:bg-emerald-900/20">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Total no ano</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{formatCurrency(dividends.totalYear)}</p>
              </div>
              <div className="card">
                <DividendsChart data={dividends.byMonth} year={dividendYear} />
              </div>
              {/* Tabela de detalhes */}
              <div className="card">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Detalhamento</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs uppercase">
                        <th className="text-left p-3">Data</th>
                        <th className="text-left p-3">Ativo</th>
                        <th className="text-left p-3">Tipo</th>
                        <th className="text-right p-3">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {Object.values(dividends.byMonth)
                        .flatMap((m) => m.items)
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="p-3 tabular-nums">{new Date(item.date).toLocaleDateString('pt-BR')}</td>
                            <td className="p-3 font-medium">{item.asset}</td>
                            <td className="p-3">{TX_TYPE_LABELS[item.type] || item.type}</td>
                            <td className="p-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(item.amount)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'metas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Metas de Investimento</h3>
            <button
              type="button"
              onClick={() => { setEditingGoal(null); setShowGoalModal(true); }}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <Plus size={16} /> Nova meta
            </button>
          </div>
          {goals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 py-14 text-center">
              <Target className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="font-medium text-gray-500 dark:text-gray-400">Nenhuma meta de investimento criada</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Defina metas como "Aposentadoria" ou "Reserva de emergência"</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {goals.map((goal) => (
                <div key={goal.id} className="relative">
                  <GoalProgressCard goal={goal} onSelect={(g) => { setEditingGoal(g); setShowGoalModal(true); }} />
                  <button
                    type="button"
                    onClick={() => handleDeleteGoal(goal.id)}
                    className="absolute top-3 right-3 p-1 text-gray-400 hover:text-red-500"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'historico' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Histórico de Transações</h3>
          {investments.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Sem transações</p>
          ) : (
            <HistoryTable investments={investments} onDelete={handleDeleteTransaction} />
          )}
        </div>
      )}

      {/* Modais */}
      <InvestmentFormModal
        isOpen={showInvestmentModal}
        onClose={() => { setShowInvestmentModal(false); setEditingInvestment(null); }}
        onSave={handleSaveInvestment}
        investment={editingInvestment}
      />
      <TransactionFormModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        onSave={handleSaveTransaction}
        investment={transactionTarget}
      />
      <GoalFormModal
        isOpen={showGoalModal}
        onClose={() => { setShowGoalModal(false); setEditingGoal(null); }}
        onSave={handleSaveGoal}
        goal={editingGoal}
      />
    </div>
  );
}

// Sub-component for history tab
function HistoryTable({ investments, onDelete }) {
  const [allTransactions, setAllTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAll() {
      try {
        const promises = investments.map((inv) =>
          investmentsAPI.getTransactions(inv.id).then((txs) =>
            txs.map((tx) => ({
              ...tx,
              investmentName: inv.name,
              investmentTicker: inv.ticker,
              indexer: inv.indexer,
            }))
          )
        );
        const results = await Promise.all(promises);
        const all = results.flat().sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate));
        setAllTransactions(all);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, [investments]);

  if (loading) {
    return <div className="text-center py-6 text-gray-400 text-sm">Carregando...</div>;
  }

  if (allTransactions.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">Nenhuma transação registrada</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs uppercase">
            <th className="text-left p-3">Data</th>
            <th className="text-left p-3">Ativo</th>
            <th className="text-left p-3">Tipo</th>
            <th className="text-right p-3">Qtd</th>
            <th className="text-right p-3">Preço</th>
            <th className="text-right p-3">Taxa</th>
            <th className="text-right p-3">Total</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {allTransactions.map((tx) => (
            <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="p-3 tabular-nums">{new Date(tx.transactionDate).toLocaleDateString('pt-BR')}</td>
              <td className="p-3 font-medium">{tx.investmentTicker || tx.investmentName}</td>
              <td className="p-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  tx.type === 'APORTE' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : tx.type === 'RESGATE' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                  : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                }`}>
                  {TX_TYPE_LABELS[tx.type] || tx.type}
                </span>
              </td>
              <td className="p-3 text-right tabular-nums">{Number(tx.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 8 })}</td>
              <td className="p-3 text-right tabular-nums">{formatCurrency(tx.unitPrice)}</td>
              <td className="p-3 text-right tabular-nums">
                {tx.interestRate != null
                  ? formatContractedRate(tx.indexer, tx.interestRate)
                  : '—'}
              </td>
              <td className="p-3 text-right tabular-nums font-semibold">{formatCurrency(tx.totalAmount)}</td>
              <td className="p-3 text-right">
                <button
                  type="button"
                  onClick={() => onDelete(tx.id)}
                  className="p-1 text-gray-400 hover:text-red-500"
                  title="Excluir"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
