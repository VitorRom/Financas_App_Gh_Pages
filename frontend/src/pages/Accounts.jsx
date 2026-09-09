import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Wallet, CreditCard, Banknote, PiggyBank, TrendingUp } from 'lucide-react';
import { accountsAPI } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import { ErrorState, LoadingState } from '../components/ui/StateMessage.jsx';

const accountTypes = [
  { value: 'checking', label: 'Conta Corrente', icon: Banknote, color: '#10b981' },
  { value: 'savings', label: 'Poupança', icon: PiggyBank, color: '#0ea5e9' },
  { value: 'credit_card', label: 'Cartão de Crédito', icon: CreditCard, color: '#ef4444' },
  { value: 'cash', label: 'Dinheiro', icon: Wallet, color: '#f59e0b' },
  { value: 'investment', label: 'Conta de Investimento', icon: TrendingUp, color: '#8b5cf6' },
];

export default function Accounts() {
  const toast = useToast();
  const confirm = useConfirm();
  const [loadError, setLoadError] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'checking',
    balance: '',
    color: '#10b981',
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    setLoadError(null);
    try {
      const data = await accountsAPI.getAll();
      setAccounts(data);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        balance: parseFloat(formData.balance) || 0,
      };

      if (editingAccount) {
        await accountsAPI.update(editingAccount.id, payload);
      } else {
        await accountsAPI.create(payload);
      }
      closeModal();
      loadAccounts();
      toast.success(editingAccount ? 'Conta atualizada.' : 'Conta criada.');
    } catch (error) {
      toast.error(error.message, { title: 'Não foi possível salvar' });
    }
  }

  async function handleDelete(account) {
    const ok = await confirm({
      title: 'Excluir conta?',
      message: `"${account.name}" será removida permanentemente.`,
      confirmLabel: 'Excluir',
    });
    if (!ok) return;

    try {
      await accountsAPI.delete(account.id);
      loadAccounts();
      toast.success('Conta excluída.');
    } catch (error) {
      // O backend recusa contas com transações vinculadas e explica o porquê.
      toast.error(error.message, { title: 'Não foi possível excluir' });
    }
  }

  function openModal(account = null) {
    if (account) {
      setEditingAccount(account);
      setFormData({
        name: account.name,
        type: account.type,
        balance: account.balance.toString(),
        color: account.color,
      });
    } else {
      setFormData({
        name: '',
        type: 'checking',
        balance: '',
        color: '#10b981',
      });
    }
    setShowModal(true);
  }

  function handleTypeChange(newType) {
    const defaultsByType = {
      checking: '#10b981',
      savings: '#0ea5e9',
      credit_card: '#ef4444',
      cash: '#f59e0b',
      investment: '#8b5cf6',
    };
    setFormData({
      ...formData,
      type: newType,
      // Ao trocar para investment, limpa o saldo (é sempre 0/derivado).
      balance: newType === 'investment' ? '' : formData.balance,
      color: defaultsByType[newType] || formData.color,
    });
  }

  function closeModal() {
    setShowModal(false);
    setEditingAccount(null);
  }

  function getAccountTypeInfo(type) {
    return accountTypes.find((t) => t.value === type) || accountTypes[0];
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  const totalBalance = accounts
    .filter((a) => a.type !== 'investment')
    .reduce((sum, acc) => sum + acc.balance, 0);

  const investmentCount = accounts.filter((a) => a.type === 'investment').length;

  // Contas de investimento têm `balance = 0`; o valor delas vem das posições.
  const investedTotal = accounts
    .filter((a) => a.type === 'investment')
    .reduce((sum, a) => sum + (a.investedValue || 0), 0);

  if (loading) return <LoadingState label="Carregando contas…" />;

  if (loadError) {
    return (
      <div className="pt-6">
        <ErrorState message={loadError} onRetry={loadAccounts} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Contas</h2>
        <button onClick={() => openModal()} className="btn btn-primary flex items-center gap-2">
          <Plus size={20} />
          Nova Conta
        </button>
      </div>

      {/* Total Balance Card */}
      <div className="card bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <p className="text-sm opacity-80">Saldo em conta</p>
        <p className="text-3xl font-bold mt-1">{formatCurrency(totalBalance)}</p>
        {investedTotal > 0 && (
          <p className="text-sm opacity-90 mt-2">
            + {formatCurrency(investedTotal)} investido ={' '}
            <span className="font-semibold">{formatCurrency(totalBalance + investedTotal)}</span> no total
          </p>
        )}
        <p className="text-sm opacity-80 mt-1">
          {accounts.length} {accounts.length === 1 ? 'conta' : 'contas'}
          {investmentCount > 0 && (
            <span className="ml-1">
              • {investmentCount} de investimento
            </span>
          )}
        </p>
      </div>

      {/* Accounts List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.length > 0 ? (
          accounts.map((account) => {
            const typeInfo = getAccountTypeInfo(account.type);
            const Icon = typeInfo.icon;
            const isInvestment = account.type === 'investment';
            return (
              <div key={account.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: `${account.color}20` }}
                    >
                      <Icon size={24} style={{ color: account.color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{account.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                        {typeInfo.label}
                        {isInvestment && (
                          <span className="text-[10px] uppercase tracking-wide font-semibold text-violet-600 dark:text-violet-400">
                            • não compõe saldo base
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openModal(account)}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(account)}
                      className="p-2 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="mt-4">
                  {isInvestment ? (
                    <>
                      <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">
                        {formatCurrency(account.investedValue || 0)}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Das posições na aba Investimentos
                      </p>
                    </>
                  ) : (
                    <>
                      <p className={`text-2xl font-bold ${account.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(account.balance)}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {account._count?.transactions || 0} transações
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
            Nenhuma conta cadastrada
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold">
                {editingAccount ? 'Editar Conta' : 'Nova Conta'}
              </h3>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="label">Nome *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="Ex: Nubank, Itaú..."
                  required
                />
              </div>

              <div>
                <label className="label">Tipo *</label>
                <select
                  value={formData.type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="select"
                >
                  {accountTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {formData.type !== 'investment' && (
                <div>
                  <label className="label">Saldo Inicial</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.balance}
                    onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                    className="input"
                    placeholder="0,00"
                  />
                </div>
              )}

              {formData.type === 'investment' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 bg-violet-50 dark:bg-violet-950/30 text-violet-800 dark:text-violet-300 rounded-lg px-3 py-2">
                  Conta de Investimento: o saldo é derivado das posições cadastradas na aba Investimentos.
                </p>
              )}

              <div>
                <label className="label">Cor</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="input flex-1"
                  />
                </div>
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
    </div>
  );
}