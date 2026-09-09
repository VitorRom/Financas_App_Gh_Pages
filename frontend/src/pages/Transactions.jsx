import { useState, useEffect } from 'react';
import { Plus, Search, ArrowUpRight, ArrowDownRight, Pencil, Trash2, X, Upload } from 'lucide-react';
import { transactionsAPI, categoriesAPI, accountsAPI, importsAPI, rulesAPI, maintenanceAPI, importBatchesAPI } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import { ErrorState, LoadingState } from '../components/ui/StateMessage.jsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Transactions() {
  const toast = useToast();
  const confirm = useConfirm();
  const [loadError, setLoadError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [applyRuleToSimilar, setApplyRuleToSimilar] = useState(true);
  const [importFile, setImportFile] = useState(null);
  const [importAccountId, setImportAccountId] = useState('');
  const [importing, setImporting] = useState(false);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeRange, setPurgeRange] = useState('last24h');
  const [purgeStart, setPurgeStart] = useState('');
  const [purgeEnd, setPurgeEnd] = useState('');
  const [purging, setPurging] = useState(false);
  const [showImportBatchesModal, setShowImportBatchesModal] = useState(false);
  const [importBatches, setImportBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [filters, setFilters] = useState({
    type: '',
    categoryId: '',
    search: '',
    excludeInternal: true,
  });

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: 'expense',
    date: format(new Date(), 'yyyy-MM-dd'),
    categoryId: '',
    accountId: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.excludeInternal]);

  async function loadData() {
    setLoadError(null);
    try {
      const [transData, catData, accData] = await Promise.all([
        transactionsAPI.getAll({ excludeInternal: filters.excludeInternal ? 'true' : 'false' }),
        categoriesAPI.getAll(),
        accountsAPI.getAll(),
      ]);
      setTransactions(transData);
      setCategories(catData);
      setAccounts(accData);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editingTransaction) {
        await transactionsAPI.update(editingTransaction.id, {
          ...formData,
          amount: parseFloat(formData.amount),
        });

        if (applyRuleToSimilar && formData.categoryId) {
          await rulesAPI.applyFromTransaction({
            transactionId: editingTransaction.id,
            categoryId: formData.categoryId,
            scope: 'all',
          });
        }
      } else {
        await transactionsAPI.create({
          ...formData,
          amount: parseFloat(formData.amount),
        });
      }
      closeModal();
      loadData();
      toast.success(editingTransaction ? 'Transação atualizada.' : 'Transação criada.');
    } catch (error) {
      toast.error(error.message, { title: 'Não foi possível salvar' });
    }
  }

  async function handleDelete(transaction) {
    const ok = await confirm({
      title: 'Excluir transação?',
      message: `"${transaction.description}" será removida e o saldo da conta será ajustado.`,
      confirmLabel: 'Excluir',
    });
    if (!ok) return;

    try {
      await transactionsAPI.delete(transaction.id);
      loadData();
      toast.success('Transação excluída.');
    } catch (error) {
      toast.error(error.message, { title: 'Não foi possível excluir' });
    }
  }

  async function handleImportSubmit(e) {
    e.preventDefault();
    if (!importFile) {
      toast.warning('Selecione um arquivo para importar.');
      return;
    }
    if (!importAccountId) {
      toast.warning('Selecione a conta que receberá as transações.');
      return;
    }

    try {
      setImporting(true);
      const result = await importsAPI.importStatement({
        file: importFile,
        accountId: importAccountId,
      });

      const linhas = [
        `${result.imported} de ${result.parsed} lançamentos importados.`,
        result.skipped > 0 ? `${result.skipped} ignorados por já existirem.` : null,
        result.unrecognized > 0
          ? `${result.unrecognized} linha(s) não foram reconhecidas e ficaram de fora.`
          : null,
      ].filter(Boolean);

      if (result.unrecognized > 0) {
        toast.warning(linhas.join('\n'), { title: 'Importação concluída com ressalvas', duration: 12000 });
      } else {
        toast.success(linhas.join('\n'), { title: 'Importação concluída' });
      }

      setShowImportModal(false);
      setImportFile(null);
      setImportAccountId('');
      loadData();
    } catch (error) {
      toast.error(error.message, { title: 'Falha ao importar extrato' });
    } finally {
      setImporting(false);
    }
  }

  async function handlePurgeSubmit(e) {
    e.preventDefault();
    const ok = await confirm({
      title: 'Apagar transações do período?',
      message:
        'As transações do período escolhido serão removidas e os saldos recalculados a partir do saldo de abertura das contas. Não dá para desfazer.',
      confirmLabel: 'Apagar',
    });
    if (!ok) return;

    try {
      setPurging(true);
      const result = await maintenanceAPI.purge({
        range: purgeRange,
        startDate: purgeRange === 'custom' ? purgeStart : undefined,
        endDate: purgeRange === 'custom' ? purgeEnd : undefined,
      });
      toast.success(
        result.deleted === 1 ? '1 transação apagada.' : `${result.deleted} transações apagadas.`,
      );
      setShowPurgeModal(false);
      loadData();
    } catch (error) {
      toast.error(error.message, { title: 'Não foi possível apagar' });
    } finally {
      setPurging(false);
    }
  }

  async function openImportBatches() {
    setShowImportBatchesModal(true);
    setLoadingBatches(true);
    try {
      const batches = await importBatchesAPI.list();
      setImportBatches(batches);
    } catch (error) {
      toast.error(error.message, { title: 'Não foi possível listar as importações' });
    } finally {
      setLoadingBatches(false);
    }
  }

  async function deleteBatch(batch) {
    const ok = await confirm({
      title: 'Apagar esta importação?',
      message: `As ${batch._count?.transactions || 0} transações vindas de "${batch.filename}" serão removidas e os saldos recalculados.`,
      confirmLabel: 'Apagar importação',
    });
    if (!ok) return;

    try {
      const result = await importBatchesAPI.delete(batch.id);
      const batches = await importBatchesAPI.list();
      setImportBatches(batches);
      loadData();
      toast.success(`${result.deletedTransactions} transações removidas.`);
    } catch (error) {
      toast.error(error.message, { title: 'Não foi possível apagar a importação' });
    }
  }

  function openModal(transaction = null) {
    if (transaction) {
      setEditingTransaction(transaction);
      setApplyRuleToSimilar(true);
      setFormData({
        description: transaction.description,
        amount: transaction.amount.toString(),
        type: transaction.type,
        date: format(new Date(transaction.date), 'yyyy-MM-dd'),
        categoryId: transaction.categoryId || '',
        accountId: transaction.accountId || '',
        notes: transaction.notes || '',
      });
    } else {
      setFormData({
        description: '',
        amount: '',
        type: 'expense',
        date: format(new Date(), 'yyyy-MM-dd'),
        categoryId: '',
        accountId: '',
        notes: '',
      });
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingTransaction(null);
  }

  const filteredTransactions = transactions.filter((t) => {
    if (filters.type && t.type !== filters.type) return false;
    if (filters.categoryId && t.categoryId !== filters.categoryId) return false;
    if (filters.search && !t.description.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <LoadingState label="Carregando transações…" />;

  if (loadError) {
    return (
      <div className="pt-6">
        <ErrorState message={loadError} onRetry={loadData} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Transações</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowImportModal(true)} className="btn btn-secondary flex items-center gap-2">
            <Upload size={18} />
            Importar Extrato
          </button>
          <button onClick={openImportBatches} className="btn btn-secondary">
            Apagar por arquivo
          </button>
          <button onClick={() => setShowPurgeModal(true)} className="btn btn-danger flex items-center gap-2">
            Apagar dados
          </button>
          <button onClick={() => openModal()} className="btn btn-primary flex items-center gap-2">
            <Plus size={20} />
            Nova Transação
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="input pl-10"
              />
            </div>
          </div>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="select sm:w-40"
          >
            <option value="">Todos</option>
            <option value="income">Receitas</option>
            <option value="expense">Despesas</option>
          </select>
          <select
            value={filters.categoryId}
            onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
            className="select sm:w-48"
          >
            <option value="">Todas categorias</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={filters.excludeInternal}
              onChange={(e) => setFilters({ ...filters, excludeInternal: e.target.checked })}
            />
            Ocultar transferências internas
          </label>
        </div>
      </div>

      {/* Transactions List */}
      <div className="card">
        {filteredTransactions.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between py-4"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-full ${
                      transaction.type === 'income'
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : 'bg-red-100 dark:bg-red-900/30'
                    }`}
                  >
                    {transaction.type === 'income' ? (
                      <ArrowUpRight className="text-green-600" size={24} />
                    ) : (
                      <ArrowDownRight className="text-red-600" size={24} />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {transaction.description}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {transaction.category?.name || 'Sem categoria'} •{' '}
                      {transaction.account?.name || 'Sem conta'} •{' '}
                      {format(new Date(transaction.date), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p
                    className={`text-lg font-semibold ${
                      transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openModal(transaction)}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(transaction)}
                      className="p-2 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Nenhuma transação encontrada
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold">
                {editingTransaction ? 'Editar Transação' : 'Nova Transação'}
              </h3>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="label">Descrição *</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Valor *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Tipo *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="select"
                  >
                    <option value="expense">Despesa</option>
                    <option value="income">Receita</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Data</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Categoria</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="select"
                >
                  <option value="">Selecione...</option>
                  {categories
                    .filter((c) => c.type === formData.type)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
                {editingTransaction && formData.type === 'expense' && (
                  <label className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={applyRuleToSimilar}
                      onChange={(e) => setApplyRuleToSimilar(e.target.checked)}
                    />
                    Aplicar esta categoria para transações semelhantes (mesmo destino)
                  </label>
                )}
              </div>

              <div>
                <label className="label">Conta</label>
                <select
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                  className="select"
                >
                  <option value="">Selecione...</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Observações</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold">Importar Extrato</h3>
              <button
                onClick={() => {
                  if (importing) return;
                  setShowImportModal(false);
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleImportSubmit} className="p-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Formatos suportados: Itaú PDF, PicPay PDF e BTG XLS/XLSX.
              </p>

              <div>
                <label className="label">Conta *</label>
                <select
                  value={importAccountId}
                  onChange={(e) => setImportAccountId(e.target.value)}
                  className="select"
                  required
                >
                  <option value="">Selecione...</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Arquivo *</label>
                <input
                  type="file"
                  accept=".pdf,.xls,.xlsx"
                  className="input"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="btn btn-secondary flex-1"
                  disabled={importing}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1" disabled={importing}>
                  {importing ? 'Importando...' : 'Importar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Purge Modal */}
      {showPurgeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold">Apagar dados</h3>
              <button
                onClick={() => {
                  if (purging) return;
                  setShowPurgeModal(false);
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handlePurgeSubmit} className="p-4 space-y-4">
              <div>
                <label className="label">Período</label>
                <select value={purgeRange} onChange={(e) => setPurgeRange(e.target.value)} className="select">
                  <option value="last24h">Últimas 24 horas</option>
                  <option value="last7d">Última semana</option>
                  <option value="last30d">Últimos 30 dias</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>

              {purgeRange === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Início</label>
                    <input type="date" className="input" value={purgeStart} onChange={(e) => setPurgeStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Fim</label>
                    <input type="date" className="input" value={purgeEnd} onChange={(e) => setPurgeEnd(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPurgeModal(false)} className="btn btn-secondary flex-1" disabled={purging}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-danger flex-1" disabled={purging}>
                  {purging ? 'Apagando...' : 'Apagar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Batches Modal */}
      {showImportBatchesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold">Importações (por arquivo)</h3>
              <button onClick={() => setShowImportBatchesModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              {loadingBatches ? (
                <div className="text-gray-500">Carregando...</div>
              ) : importBatches.length === 0 ? (
                <div className="text-gray-500">Nenhuma importação registrada ainda.</div>
              ) : (
                <div className="space-y-2">
                  {importBatches.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
                      <div>
                        <div className="font-medium">{b.filename}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-300">
                          {b.bank || 'Banco desconhecido'} • {b.account?.name || 'Conta'} • {b._count?.transactions || 0} transações •{' '}
                          {new Date(b.createdAt).toLocaleString('pt-BR')}
                        </div>
                      </div>
                      <button className="btn btn-danger" onClick={() => deleteBatch(b)}>
                        Apagar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}