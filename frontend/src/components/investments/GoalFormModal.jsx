import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const ASSET_TYPES = [
  'RENDA_FIXA', 'ACAO', 'FII', 'ETF', 'CRIPTO', 'FUNDO', 'TESOURO_DIRETO', 'PREVIDENCIA', 'OUTRO',
];

const ASSET_TYPE_LABELS = {
  RENDA_FIXA: 'Renda Fixa', ACAO: 'Ação', FII: 'FII', ETF: 'ETF', CRIPTO: 'Cripto',
  FUNDO: 'Fundo', TESOURO_DIRETO: 'Tesouro Direto', PREVIDENCIA: 'Previdência', OUTRO: 'Outro',
};

export default function GoalFormModal({ isOpen, onClose, onSave, goal }) {
  const isEdit = !!goal;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    targetAmount: '',
    targetDate: '',
    monthlyContribution: '',
    expectedReturnRate: '',
    currentAmount: '0',
    assetTypes: [],
  });

  useEffect(() => {
    if (isOpen && goal) {
      setForm({
        name: goal.name,
        targetAmount: String(goal.targetAmount),
        targetDate: new Date(goal.targetDate).toISOString().split('T')[0],
        monthlyContribution: String(goal.monthlyContribution),
        expectedReturnRate: String(goal.expectedReturnRate),
        currentAmount: String(goal.currentAmount || 0),
        assetTypes: goal.assetTypes || [],
      });
    } else if (isOpen) {
      setForm({ name: '', targetAmount: '', targetDate: '', monthlyContribution: '', expectedReturnRate: '', currentAmount: '0', assetTypes: [] });
    }
  }, [isOpen, goal]);

  function toggleAssetType(type) {
    setForm((f) => ({
      ...f,
      assetTypes: f.assetTypes.includes(type)
        ? f.assetTypes.filter((t) => t !== type)
        : [...f.assetTypes, type],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Editar Meta' : 'Nova Meta de Investimento'}
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Nome <span className="text-red-400">*</span></label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Aposentadoria" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Valor alvo (R$) <span className="text-red-400">*</span></label>
              <input className="input" type="number" step="0.01" min="1" value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} required />
            </div>
            <div>
              <label className="label">Data alvo <span className="text-red-400">*</span></label>
              <input className="input" type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Aporte mensal (R$) <span className="text-red-400">*</span></label>
              <input className="input" type="number" step="0.01" min="0" value={form.monthlyContribution} onChange={(e) => setForm({ ...form, monthlyContribution: e.target.value })} required />
            </div>
            <div>
              <label className="label">Retorno anual (%) <span className="text-red-400">*</span></label>
              <input className="input" type="number" step="0.01" value={form.expectedReturnRate} onChange={(e) => setForm({ ...form, expectedReturnRate: e.target.value })} placeholder="Ex: 12" required />
            </div>
          </div>

          <div>
            <label className="label">Valor atual (R$)</label>
            <input className="input" type="number" step="0.01" min="0" value={form.currentAmount} onChange={(e) => setForm({ ...form, currentAmount: e.target.value })} />
          </div>

          <div>
            <label className="label mb-2">Tipos de ativo da meta</label>
            <div className="flex flex-wrap gap-2">
              {ASSET_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleAssetType(type)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    form.assetTypes.includes(type)
                      ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  {ASSET_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar meta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
