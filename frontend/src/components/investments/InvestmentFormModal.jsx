import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { accountsAPI, marketAPI } from '../../services/api.js';

const ASSET_TYPES = [
  { value: 'RENDA_FIXA', label: 'Renda Fixa' },
  { value: 'ACAO', label: 'Ação' },
  { value: 'FII', label: 'FII' },
  { value: 'ETF', label: 'ETF' },
  { value: 'CRIPTO', label: 'Cripto' },
  { value: 'FUNDO', label: 'Fundo' },
  { value: 'TESOURO_DIRETO', label: 'Tesouro Direto' },
  { value: 'PREVIDENCIA', label: 'Previdência' },
  { value: 'OUTRO', label: 'Outro' },
];

const INDEXERS = [
  { value: 'PRE', label: 'Prefixado' },
  { value: 'CDI', label: 'CDI' },
  { value: 'IPCA', label: 'IPCA' },
  { value: 'SELIC', label: 'SELIC' },
  { value: 'IGPM', label: 'IGP-M' },
  { value: 'NONE', label: 'Nenhum' },
];

const REQUIRES_TICKER = ['ACAO', 'FII', 'ETF', 'CRIPTO'];
const FIXED_INCOME_TYPES = ['RENDA_FIXA', 'TESOURO_DIRETO'];

export default function InvestmentFormModal({ isOpen, onClose, onSave, investment }) {
  const isEdit = !!investment;
  const [accounts, setAccounts] = useState([]);
  const [tickerWarning, setTickerWarning] = useState('');
  const [saving, setSaving] = useState(false);
  const [brokerManuallyEdited, setBrokerManuallyEdited] = useState(false);

  const [form, setForm] = useState({
    assetType: 'ACAO',
    ticker: '',
    name: '',
    broker: '',
    accountId: '',
    indexer: 'CDI',
    interestRate: '',
    maturityDate: '',
    liquidityDays: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      accountsAPI.getAll().then(setAccounts).catch(() => {});
      if (investment) {
        setForm({
          assetType: investment.assetType,
          ticker: investment.ticker || '',
          name: investment.name,
          broker: investment.broker || '',
          accountId: investment.accountId || '',
          indexer: investment.indexer || 'CDI',
          interestRate: investment.interestRate ?? '',
          maturityDate: investment.maturityDate ? new Date(investment.maturityDate).toISOString().split('T')[0] : '',
          liquidityDays: investment.liquidityDays ?? '',
          purchaseDate: investment.purchaseDate ? new Date(investment.purchaseDate).toISOString().split('T')[0] : '',
          notes: investment.notes || '',
        });
        // Em modo edição, se já houver broker preenchido, trata como manual para
        // não sobrescrever ao trocar a conta de origem.
        setBrokerManuallyEdited(!!investment.broker);
      } else {
        setForm((f) => ({ ...f, assetType: 'ACAO', ticker: '', name: '', broker: '', accountId: '', indexer: 'CDI', interestRate: '', maturityDate: '', liquidityDays: '', purchaseDate: new Date().toISOString().split('T')[0], notes: '' }));
        setBrokerManuallyEdited(false);
      }
      setTickerWarning('');
    }
  }, [isOpen, investment]);

  const selectedAccount = accounts.find((a) => a.id === form.accountId) || null;
  const isPrefilled = !brokerManuallyEdited && selectedAccount?.type === 'investment' && form.broker === selectedAccount.name;

  async function validateTicker() {
    if (!form.ticker) return;
    if (form.assetType === 'TESOURO_DIRETO') {
      setTickerWarning('');
      return;
    }
    try {
      const quote = await marketAPI.getQuote(form.ticker);
      if (quote.error) {
        setTickerWarning(`Ticker "${form.ticker}" não encontrado na BrAPI. Você pode salvar mesmo assim.`);
      } else {
        setTickerWarning('');
        if (!form.name && quote.ticker) {
          setForm((f) => ({ ...f, name: f.name || quote.ticker }));
        }
      }
    } catch (err) {
      console.error('Erro ao validar ticker:', err);
      setTickerWarning('Não foi possível validar o ticker.');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...form,
        accountId: form.accountId || null,
        interestRate: form.interestRate !== '' ? parseFloat(form.interestRate) : null,
        liquidityDays: form.liquidityDays !== '' ? parseInt(form.liquidityDays) : null,
        maturityDate: form.maturityDate || null,
      });
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const isFixed = FIXED_INCOME_TYPES.includes(form.assetType);
  const needsTicker = REQUIRES_TICKER.includes(form.assetType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Editar Investimento' : 'Novo Investimento'}
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Tipo de ativo</label>
            <select className="select" value={form.assetType} onChange={(e) => setForm({ ...form, assetType: e.target.value })}>
              {ASSET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nome{' '}<span className="text-red-400">*</span></label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Petrobras" required />
            </div>
            <div>
              <label className="label">Ticker {needsTicker && <span className="text-red-400">*</span>}</label>
              <input
                className="input font-mono"
                value={form.ticker}
                onChange={(e) => {
                  const value = form.assetType === 'TESOURO_DIRETO'
                    ? e.target.value
                    : e.target.value.toUpperCase();
                  setForm({ ...form, ticker: value });
                }}
                onBlur={validateTicker}
                placeholder={form.assetType === 'TESOURO_DIRETO' ? 'Opcional — preenchido automaticamente' : 'Ex: PETR4'}
                required={needsTicker}
              />
            </div>
          </div>

          {tickerWarning && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-lg">{tickerWarning}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Corretora</label>
              <input
                className="input"
                value={form.broker}
                onChange={(e) => {
                  setBrokerManuallyEdited(true);
                  setForm({ ...form, broker: e.target.value });
                }}
                placeholder="Ex: XP"
              />
              {isPrefilled && (
                <p className="mt-1 text-[11px] text-violet-700 dark:text-violet-300">
                  Pré-preenchido a partir da conta de origem.
                </p>
              )}
            </div>
            <div>
              <label className="label">Conta de origem</label>
              <select
                className="select"
                value={form.accountId}
                onChange={(e) => {
                  const newId = e.target.value;
                  const acc = accounts.find((a) => a.id === newId);
                  const shouldPrefill = !brokerManuallyEdited && acc?.type === 'investment';
                  setForm({
                    ...form,
                    accountId: newId,
                    broker: shouldPrefill && acc ? acc.name : form.broker,
                  });
                }}
              >
                <option value="">Nenhuma</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {selectedAccount?.type === 'investment' && (
                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                  Conta de investimento selecionada.
                </p>
              )}
            </div>
          </div>

          {isFixed && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Indexador <span className="text-red-400">*</span></label>
                  <select className="select" value={form.indexer} onChange={(e) => setForm({ ...form, indexer: e.target.value })}>
                    {INDEXERS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Taxa contratada (%) <span className="text-red-400">*</span></label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={form.interestRate}
                    onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                    placeholder={form.indexer === 'IPCA' ? 'Ex: 7.10  →  IPCA+7,10' : form.indexer === 'CDI' ? 'Ex: 110' : 'Ex: 12.5'}
                    required
                  />
                  {form.assetType === 'TESOURO_DIRETO' && (
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                      Taxa da compra. Novos aportes ficam no histórico com a taxa daquele momento.
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Vencimento <span className="text-red-400">*</span></label>
                  <input className="input" type="date" value={form.maturityDate} onChange={(e) => setForm({ ...form, maturityDate: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Liquidez (dias)</label>
                  <input className="input" type="number" min="0" value={form.liquidityDays} onChange={(e) => setForm({ ...form, liquidityDays: e.target.value })} placeholder="Ex: 0" />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="label">Data da compra <span className="text-red-400">*</span></label>
            <input className="input" type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} required />
          </div>

          <div>
            <label className="label">Observações</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas opcionais..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar investimento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
