import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

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

export default function TransactionFormModal({ isOpen, onClose, onSave, investment }) {
  const investmentName = investment?.name;
  const isTreasuryOrFixed = ['TESOURO_DIRETO', 'RENDA_FIXA'].includes(investment?.assetType);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: 'APORTE',
    quantity: '',
    unitPrice: '',
    totalAmount: '',
    fees: '0',
    interestRate: '',
    transactionDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      setForm({
        type: 'APORTE',
        quantity: '',
        unitPrice: '',
        totalAmount: '',
        fees: '0',
        interestRate: investment?.interestRate != null ? String(investment.interestRate) : '',
        transactionDate: new Date().toISOString().split('T')[0],
        notes: '',
      });
    }
  }, [isOpen, investment]);

  // Auto-calcular total
  const qty = parseFloat(form.quantity) || 0;
  const price = parseFloat(form.unitPrice) || 0;
  const fees = parseFloat(form.fees) || 0;
  const calculatedTotal = qty * price + fees;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...form,
        quantity: parseFloat(form.quantity) || 0,
        unitPrice: parseFloat(form.unitPrice) || 0,
        totalAmount: form.totalAmount ? parseFloat(form.totalAmount) : calculatedTotal,
        fees: parseFloat(form.fees) || 0,
        interestRate: form.interestRate !== '' ? parseFloat(form.interestRate) : null,
      });
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const showQuantityPrice = ['APORTE', 'RESGATE', 'BONIFICACAO', 'DESDOBRAMENTO', 'GRUPAMENTO'].includes(form.type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nova Transação</h3>
            {investmentName && <p className="text-sm text-gray-500 dark:text-gray-400">{investmentName}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Tipo <span className="text-red-400">*</span></label>
            <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TX_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {showQuantityPrice && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Quantidade <span className="text-red-400">*</span></label>
                <input className="input" type="number" step="any" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
              </div>
              <div>
                <label className="label">Preço unitário <span className="text-red-400">*</span></label>
                <input className="input" type="number" step="0.01" min="0" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} required />
              </div>
            </div>
          )}

          {isTreasuryOrFixed && form.type === 'APORTE' && (
            <div>
              <label className="label">
                Taxa contratada (%) {investment?.assetType === 'TESOURO_DIRETO' && <span className="text-red-400">*</span>}
              </label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={form.interestRate}
                onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                placeholder={investment?.indexer === 'IPCA' ? 'Ex: 7.10  →  IPCA+7,10' : 'Ex: 7.10'}
                required={investment?.assetType === 'TESOURO_DIRETO'}
              />
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                Taxa da compra neste momento. Cada aporte pode ter uma taxa diferente (ex.: 7,10 e depois 7,30).
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Total (R$)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={form.totalAmount}
                onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                placeholder={showQuantityPrice ? calculatedTotal.toFixed(2) : '0.00'}
              />
            </div>
            <div>
              <label className="label">Taxas (R$)</label>
              <input className="input" type="number" step="0.01" min="0" value={form.fees} onChange={(e) => setForm({ ...form, fees: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="label">Data <span className="text-red-400">*</span></label>
            <input className="input" type="date" value={form.transactionDate} onChange={(e) => setForm({ ...form, transactionDate: e.target.value })} max={new Date().toISOString().split('T')[0]} required />
          </div>

          <div>
            <label className="label">Observações</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
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
