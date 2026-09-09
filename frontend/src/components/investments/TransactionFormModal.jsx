import { useState, useEffect, useCallback } from 'react';
import { X, Info, AlertTriangle } from 'lucide-react';
import { marketAPI } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';

const TX_TYPES = [
  { value: 'APORTE', label: 'Aporte' },
  { value: 'RESGATE', label: 'Resgate' },
  { value: 'DIVIDENDO', label: 'Dividendo' },
  { value: 'JCP', label: 'JCP' },
  { value: 'RENDIMENTO', label: 'Rendimento' },
  { value: 'BONIFICACAO', label: 'Bonificação' },
  { value: 'DESDOBRAMENTO', label: 'Desdobramento' },
  { value: 'GRUPAMENTO', label: 'Grupamento' },
];

const QUANTITY_TYPES = ['APORTE', 'RESGATE', 'BONIFICACAO', 'DESDOBRAMENTO', 'GRUPAMENTO'];

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

const emptyForm = () => ({
  type: 'APORTE',
  quantity: '',
  unitPrice: '',
  fees: '0',
  interestRate: '',
  transactionDate: new Date().toISOString().split('T')[0],
  notes: '',
});

export default function TransactionFormModal({ isOpen, onClose, onSave, investment }) {
  const toast = useToast();
  const investmentName = investment?.name;
  const assetType = investment?.assetType;
  const isTreasury = assetType === 'TESOURO_DIRETO';
  const isTreasuryOrFixed = ['TESOURO_DIRETO', 'RENDA_FIXA'].includes(assetType);

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [quote, setQuote] = useState(null);
  // Campo auxiliar: quem compra Tesouro pensa em reais, não em fração de título.
  const [amountToInvest, setAmountToInvest] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setForm({ ...emptyForm(), interestRate: '' });
    setAmountToInvest('');
    setQuote(null);
  }, [isOpen, investment]);

  // Cotação do título, para preencher preço unitário e taxa sem digitação.
  useEffect(() => {
    if (!isOpen || !isTreasury || !investment?.ticker) return undefined;

    let cancelled = false;
    marketAPI
      .getQuote(investment.ticker, 'TESOURO_DIRETO')
      .then((q) => {
        if (cancelled || !q || q.error) return;
        setQuote(q);
      })
      .catch(() => {
        /* sem cotação o formulário segue manual */
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, isTreasury, investment?.ticker]);

  // Aporte compra pelo PU de compra; resgate vende pelo PU de venda.
  const marketPrice = quote
    ? form.type === 'RESGATE'
      ? (quote.sellPrice ?? quote.price)
      : (quote.buyPrice ?? quote.price)
    : null;
  const marketRate = quote
    ? form.type === 'RESGATE'
      ? (quote.sellRate ?? null)
      : (quote.buyRate ?? null)
    : null;

  // Preenche PU e taxa quando a cotação chega, sem sobrescrever o que já foi digitado.
  useEffect(() => {
    if (marketPrice == null) return;
    setForm((f) => ({
      ...f,
      unitPrice: f.unitPrice === '' ? String(marketPrice) : f.unitPrice,
      interestRate: f.interestRate === '' && marketRate != null ? String(marketRate) : f.interestRate,
    }));
  }, [marketPrice, marketRate]);

  const qty = parseFloat(form.quantity) || 0;
  const price = parseFloat(form.unitPrice) || 0;
  const fees = parseFloat(form.fees) || 0;
  const showQuantityPrice = QUANTITY_TYPES.includes(form.type);

  // Total é sempre derivado: quantidade × preço + taxas. Deixá-lo editável permitia
  // gravar um total que não fecha com a posição.
  const totalAmount = showQuantityPrice ? qty * price + fees : fees;

  // PU muito distante do mercado quase sempre é erro de unidade — foi o que produziu
  // uma posição de R$ 10.116 a partir de um aporte de R$ 105.
  const priceLooksOff =
    isTreasury && marketPrice != null && price > 0 && (price > marketPrice * 2 || price < marketPrice / 2);

  const applyAmount = useCallback(
    (value) => {
      setAmountToInvest(value);
      const amount = parseFloat(value);
      const unit = parseFloat(form.unitPrice);
      if (!Number.isFinite(amount) || !Number.isFinite(unit) || unit <= 0) return;
      setForm((f) => ({ ...f, quantity: String(Math.round((amount / unit) * 1e8) / 1e8) }));
    },
    [form.unitPrice],
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...form,
        quantity: qty,
        unitPrice: price,
        totalAmount,
        fees,
        interestRate: form.interestRate !== '' ? parseFloat(form.interestRate) : null,
      });
      onClose();
    } catch (err) {
      toast.error(err.message, { title: 'Não foi possível salvar' });
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nova Transação</h3>
            {investmentName && <p className="text-sm text-gray-500 dark:text-gray-400">{investmentName}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">
              Tipo <span className="text-red-400">*</span>
            </label>
            <select
              className="select"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {TX_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {isTreasury && quote && showQuantityPrice && (
            <div className="rounded-lg border border-violet-100 dark:border-violet-900/50 bg-violet-50/70 dark:bg-violet-950/25 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <Info size={13} className="mt-0.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                <p className="text-[11px] leading-relaxed text-violet-900 dark:text-violet-200">
                  {form.type === 'RESGATE' ? 'PU de venda' : 'PU de compra'} hoje:{' '}
                  <strong className="tabular-nums">{formatBRL(marketPrice)}</strong>
                  {marketRate != null && (
                    <>
                      {' · taxa '}
                      <strong className="tabular-nums">
                        {Number(marketRate).toFixed(2).replace('.', ',')}%
                      </strong>
                    </>
                  )}
                  {quote.baseDate && ` · ${quote.baseDate.split('-').reverse().join('/')}`}
                </p>
              </div>
            </div>
          )}

          {isTreasury && showQuantityPrice && (
            <div>
              <label className="label" htmlFor="tx-amount">
                Valor aplicado (R$)
              </label>
              <input
                id="tx-amount"
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={amountToInvest}
                onChange={(e) => applyAmount(e.target.value)}
                placeholder="Ex: 105,72"
              />
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                Opcional. Preenche a quantidade dividindo pelo preço unitário — títulos do
                Tesouro são comprados em frações.
              </p>
            </div>
          )}

          {showQuantityPrice && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">
                  Quantidade <span className="text-red-400">*</span>
                </label>
                <input
                  className="input"
                  type="number"
                  step="any"
                  min="0"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">
                  Preço unitário <span className="text-red-400">*</span>
                </label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.unitPrice}
                  onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                  required
                />
              </div>
            </div>
          )}

          {priceLooksOff && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                O preço unitário informado está muito distante do PU de mercado
                ({formatBRL(marketPrice)}). Confira: o preço é por título, não o valor total
                aplicado. Se a compra foi antiga, o PU daquela data está correto — pode seguir.
              </p>
            </div>
          )}

          {isTreasuryOrFixed && form.type === 'APORTE' && (
            <div>
              <label className="label">
                Taxa travada na compra (%){' '}
                {isTreasury && <span className="text-red-400">*</span>}
              </label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={form.interestRate}
                onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                placeholder={investment?.indexer === 'IPCA' ? 'Ex: 7.10  →  IPCA+7,10' : 'Ex: 7.10'}
                required={isTreasury}
              />
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                {isTreasury && marketRate != null
                  ? 'Preenchida com a taxa de hoje. Ajuste se a compra foi em outra data.'
                  : 'Cada aporte pode ter uma taxa diferente; a taxa do ativo é a média ponderada delas.'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Taxas (R$)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={form.fees}
                onChange={(e) => setForm({ ...form, fees: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="tx-total">
                Total (R$)
              </label>
              <output
                id="tx-total"
                className="input flex items-center bg-gray-50 dark:bg-gray-900/50 font-semibold tabular-nums text-gray-900 dark:text-white"
              >
                {formatBRL(totalAmount)}
              </output>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                Quantidade × preço + taxas.
              </p>
            </div>
          </div>

          <div>
            <label className="label">
              Data <span className="text-red-400">*</span>
            </label>
            <input
              className="input"
              type="date"
              value={form.transactionDate}
              onChange={(e) => setForm({ ...form, transactionDate: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          <div>
            <label className="label">Observações</label>
            <textarea
              className="input"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
