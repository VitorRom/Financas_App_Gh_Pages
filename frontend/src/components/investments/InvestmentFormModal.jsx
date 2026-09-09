import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { accountsAPI, marketAPI } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import TreasuryPicker from './TreasuryPicker.jsx';

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

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

/**
 * Condições de mercado do título, vindas do Tesouro Transparente.
 *
 * Aparece no lugar do campo de taxa que existia aqui: a taxa do cadastro era digitada
 * e depois substituída pela média das taxas dos aportes, então o usuário informava o
 * mesmo dado duas vezes. O que vale saber neste ponto é a condição de hoje — e essa
 * a API já publica.
 */
function TreasuryReference({ quote }) {
  if (!quote) return null;

  const formatRate = (rate) => (rate == null ? '—' : `${Number(rate).toFixed(2).replace('.', ',')}%`);

  return (
    <div className="rounded-lg border border-violet-100 dark:border-violet-900/50 bg-violet-50/70 dark:bg-violet-950/25 px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-violet-800 dark:text-violet-300">{quote.name}</p>
        {quote.baseDate && (
          <p className="text-[10px] text-violet-700/70 dark:text-violet-400/70">
            Tesouro Transparente · {quote.baseDate.split('-').reverse().join('/')}
          </p>
        )}
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
        <div className="flex justify-between">
          <dt className="text-gray-600 dark:text-gray-400">Taxa de compra</dt>
          <dd className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatRate(quote.buyRate)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600 dark:text-gray-400">PU de compra</dt>
          <dd className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
            {quote.buyPrice != null ? formatBRL(quote.buyPrice) : '—'}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600 dark:text-gray-400">Taxa de venda</dt>
          <dd className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatRate(quote.sellRate)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600 dark:text-gray-400">PU de venda</dt>
          <dd className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
            {quote.sellPrice != null ? formatBRL(quote.sellPrice) : '—'}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] leading-relaxed text-violet-800/70 dark:text-violet-300/70">
        A taxa que você travar entra no aporte, não aqui. A taxa do ativo passa a ser a
        média das taxas dos seus aportes, ponderada pela quantidade.
      </p>
    </div>
  );
}

export default function InvestmentFormModal({ isOpen, onClose, onSave, investment }) {
  const toast = useToast();
  const isEdit = !!investment;
  const [accounts, setAccounts] = useState([]);
  const [tickerWarning, setTickerWarning] = useState('');
  // Título do Tesouro escolhido na lista. Já vem com PU e taxa do dia, então serve
  // como referência na tela sem uma segunda chamada à API.
  const [selectedTreasury, setSelectedTreasury] = useState(null);
  const [saving, setSaving] = useState(false);

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
      accountsAPI
        .getAll()
        .then(setAccounts)
        .catch((err) => toast.error(err.message, { title: 'Não foi possível carregar as contas' }));
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
      } else {
        setForm((f) => ({ ...f, assetType: 'ACAO', ticker: '', name: '', broker: '', accountId: '', indexer: 'CDI', interestRate: '', maturityDate: '', liquidityDays: '', purchaseDate: new Date().toISOString().split('T')[0], notes: '' }));
      }
      setTickerWarning('');
    }
  }, [isOpen, investment, toast]);

  const selectedAccount = accounts.find((a) => a.id === form.accountId) || null;

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

  const isTreasury = form.assetType === 'TESOURO_DIRETO';
  const investmentAccounts = accounts.filter((a) => a.type === 'investment');
  const otherAccounts = accounts.filter((a) => a.type !== 'investment');

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
      toast.error(err.message, { title: 'Não foi possível salvar' });
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

          {/* A conta de investimento já é a corretora; pedir os dois era digitar o
              mesmo dado duas vezes. O campo de corretora só aparece quando o ativo
              não está vinculado a nenhuma conta. */}
          <div>
            <label className="label" htmlFor="investment-account">
              Onde está guardado
            </label>
            <select
              id="investment-account"
              className="select"
              value={form.accountId}
              onChange={(e) => {
                const newId = e.target.value;
                const acc = accounts.find((a) => a.id === newId);
                setForm({
                  ...form,
                  accountId: newId,
                  // A corretora passa a ser o nome da conta; sem conta, volta a ser digitada.
                  broker: acc ? acc.name : '',
                });
              }}
            >
              <option value="">Nenhuma conta vinculada</option>
              {investmentAccounts.length > 0 && (
                <optgroup label="Contas de investimento">
                  {investmentAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {otherAccounts.length > 0 && (
                <optgroup label="Outras contas">
                  {otherAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              {selectedAccount
                ? `A corretora deste ativo é "${selectedAccount.name}".`
                : 'Vincular a uma conta faz o valor do ativo entrar no saldo dela.'}
            </p>
          </div>

          {!form.accountId && (
            <div>
              <label className="label" htmlFor="investment-broker">
                Corretora
              </label>
              <input
                id="investment-broker"
                className="input"
                value={form.broker}
                onChange={(e) => setForm({ ...form, broker: e.target.value })}
                placeholder="Ex: XP"
              />
            </div>
          )}

          {isTreasury && (
            <>
              <TreasuryPicker
                value={form.ticker}
                disabled={isEdit}
                onSelect={(title) => {
                  setSelectedTreasury(title);
                  setForm((f) => ({
                    ...f,
                    ticker: title.ticker,
                    name: title.name,
                    // Indexador e vencimento passam a vir do título escolhido, não da digitação.
                    indexer: (title.indexer || '').toUpperCase().replace('PREFIXADO', 'PRE'),
                    maturityDate: title.maturityDate || '',
                  }));
                }}
              />
              {selectedTreasury && <TreasuryReference quote={selectedTreasury} />}
            </>
          )}

          {isFixed && !isTreasury && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Indexador <span className="text-red-400">*</span></label>
                  <select className="select" value={form.indexer} onChange={(e) => setForm({ ...form, indexer: e.target.value })}>
                    {INDEXERS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                </div>
                {!isTreasury && (
                  <div>
                    <label className="label">Taxa contratada (%) <span className="text-red-400">*</span></label>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={form.interestRate}
                      onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                      placeholder={form.indexer === 'CDI' ? 'Ex: 110  →  110% do CDI' : 'Ex: 12.5'}
                      required
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Vencimento <span className="text-red-400">*</span></label>
                  <input className="input" type="date" value={form.maturityDate} onChange={(e) => setForm({ ...form, maturityDate: e.target.value })} required />
                </div>
                {!isTreasury && (
                  <div>
                    <label className="label">Liquidez (dias)</label>
                    <input className="input" type="number" min="0" value={form.liquidityDays} onChange={(e) => setForm({ ...form, liquidityDays: e.target.value })} placeholder="Ex: 0" />
                  </div>
                )}
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
