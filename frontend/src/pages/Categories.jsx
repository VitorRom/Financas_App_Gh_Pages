import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, TrendingUp, TrendingDown } from 'lucide-react';
import { categoriesAPI } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import { ErrorState, LoadingState } from '../components/ui/StateMessage.jsx';

export default function Categories() {
  const toast = useToast();
  const confirm = useConfirm();
  const [loadError, setLoadError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [filter, setFilter] = useState('all');

  const [formData, setFormData] = useState({
    name: '',
    type: 'expense',
    color: '#6366f1',
    icon: 'tag',
  });

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoadError(null);
    try {
      const data = await categoriesAPI.getAll();
      setCategories(data);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editingCategory) {
        await categoriesAPI.update(editingCategory.id, formData);
      } else {
        await categoriesAPI.create(formData);
      }
      closeModal();
      loadCategories();
      toast.success(editingCategory ? 'Categoria atualizada.' : 'Categoria criada.');
    } catch (error) {
      toast.error(error.message, { title: 'Não foi possível salvar' });
    }
  }

  async function handleDelete(category) {
    const ok = await confirm({
      title: 'Excluir categoria?',
      message: `"${category.name}" será removida. As transações dela ficam sem categoria.`,
      confirmLabel: 'Excluir',
    });
    if (!ok) return;

    try {
      await categoriesAPI.delete(category.id);
      loadCategories();
      toast.success('Categoria excluída.');
    } catch (error) {
      toast.error(error.message, { title: 'Não foi possível excluir' });
    }
  }

  function openModal(category = null) {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        type: category.type,
        color: category.color,
        icon: category.icon,
      });
    } else {
      setFormData({
        name: '',
        type: 'expense',
        color: '#6366f1',
        icon: 'tag',
      });
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingCategory(null);
  }

  const filteredCategories = categories.filter((c) => {
    if (filter === 'all') return true;
    return c.type === filter;
  });

  const incomeCategories = filteredCategories.filter((c) => c.type === 'income');
  const expenseCategories = filteredCategories.filter((c) => c.type === 'expense');

  if (loading) return <LoadingState label="Carregando categorias…" />;

  if (loadError) {
    return (
      <div className="pt-6">
        <ErrorState message={loadError} onRetry={loadCategories} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Categorias</h2>
        <button onClick={() => openModal()} className="btn btn-primary flex items-center gap-2">
          <Plus size={20} />
          Nova Categoria
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['all', 'income', 'expense'].map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === type
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {type === 'all' ? 'Todas' : type === 'income' ? 'Receitas' : 'Despesas'}
          </button>
        ))}
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Categories */}
        {(filter === 'all' || filter === 'expense') && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="text-red-500" size={20} />
              <h3 className="text-lg font-semibold">Despesas</h3>
            </div>
            <div className="space-y-2">
              {expenseCategories.length > 0 ? (
                expenseCategories.map((category) => (
                  <CategoryItem
                    key={category.id}
                    category={category}
                    onEdit={() => openModal(category)}
                    onDelete={() => handleDelete(category)}
                  />
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">Nenhuma categoria de despesa</p>
              )}
            </div>
          </div>
        )}

        {/* Income Categories */}
        {(filter === 'all' || filter === 'income') && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="text-green-500" size={20} />
              <h3 className="text-lg font-semibold">Receitas</h3>
            </div>
            <div className="space-y-2">
              {incomeCategories.length > 0 ? (
                incomeCategories.map((category) => (
                  <CategoryItem
                    key={category.id}
                    category={category}
                    onEdit={() => openModal(category)}
                    onDelete={() => handleDelete(category)}
                  />
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">Nenhuma categoria de receita</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold">
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
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

function CategoryItem({ category, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div className="flex items-center gap-3">
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: category.color }}
        />
        <span className="font-medium">{category.name}</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={onDelete}
          className="p-1 text-gray-400 hover:text-red-600"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}