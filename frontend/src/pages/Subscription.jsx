import { useCallback, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { subscriptionsAPI } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const FEATURE_LABELS = {
  transactions: 'Limite de transações',
  accounts: 'Contas',
  goals: 'Metas',
  planning: 'Planejamento',
  imports: 'Importação de extratos',
  export: 'Exportação de dados',
  merchantRules: 'Regras por estabelecimento',
  analytics: 'Analytics',
  apiAccess: 'Acesso à API',
};

function formatPrice(cents) {
  const value = Number(cents) / 100;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatFeatureValue(v) {
  if (v === true) return 'Incluso';
  if (v === false) return '—';
  return String(v);
}

export default function Subscription() {
  const { user, refreshUser } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [actionError, setActionError] = useState('');

  const currentPlanId = user?.subscription?.planId;

  const loadPlans = useCallback(async () => {
    setLoadError('');
    setLoadingPlans(true);
    try {
      const list = await subscriptionsAPI.getPlans();
      setPlans(Array.isArray(list) ? list : []);
    } catch (err) {
      setLoadError(err.message || 'Não foi possível carregar os planos');
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  async function handleSubscribe(planId) {
    if (planId === currentPlanId) return;
    setActionError('');
    setActionId(planId);
    try {
      await subscriptionsAPI.subscribe({ planId });
      await refreshUser();
    } catch (err) {
      setActionError(err.message || 'Não foi possível alterar o plano');
    } finally {
      setActionId(null);
    }
  }

  async function handleCancel() {
    if (!window.confirm('Voltar ao plano gratuito? Você perderá recursos dos planos pagos.')) return;
    setActionError('');
    setActionId('cancel');
    try {
      await subscriptionsAPI.cancel();
      await refreshUser();
    } catch (err) {
      setActionError(err.message || 'Não foi possível cancelar');
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Assinatura</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Planos pensados para escalar com você. Pagamento online pode ser integrado depois (ex.: Stripe);
          por enquanto a troca de plano atualiza sua conta para testes e demos.
        </p>
      </div>

      {user?.subscription && (
        <div className="card max-w-2xl border border-primary-200 dark:border-primary-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Plano atual</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">
            {user.subscription.plan?.displayName || user.subscription.plan?.name || '—'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Status: {user.subscription.status === 'canceled' ? 'cancelado (plano gratuito)' : user.subscription.status}
          </p>
          {user.subscription.plan?.name !== 'free' && (
            <button
              type="button"
              className="btn btn-secondary mt-4 text-sm"
              onClick={handleCancel}
              disabled={actionId === 'cancel'}
            >
              {actionId === 'cancel' ? 'Processando…' : 'Voltar ao plano gratuito'}
            </button>
          )}
        </div>
      )}

      {actionError && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm max-w-2xl">
          {actionError}
        </div>
      )}

      {loadError && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
          {loadError}
        </div>
      )}

      {loadingPlans ? (
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            const busy = actionId === plan.id;
            const features =
              typeof plan.features === 'object' && plan.features !== null ? plan.features : {};

            return (
              <div
                key={plan.id}
                className={`card flex flex-col h-full ${
                  isCurrent
                    ? 'ring-2 ring-primary-500 shadow-md'
                    : 'border border-gray-200 dark:border-gray-700'
                }`}
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{plan.displayName}</h3>
                <p className="text-2xl font-bold text-primary-600 dark:text-primary-400 mt-2">
                  {plan.price === 0 ? 'Grátis' : `${formatPrice(plan.price)}/mês`}
                </p>

                <ul className="mt-4 space-y-2 flex-1 text-sm text-gray-600 dark:text-gray-300">
                  {Object.entries(features).map(([key, val]) => (
                    <li key={key} className="flex gap-2">
                      <Check className="shrink-0 text-primary-500 mt-0.5" size={16} />
                      <span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {FEATURE_LABELS[key] || key}:{' '}
                        </span>
                        {formatFeatureValue(val)}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className="btn btn-primary w-full mt-6"
                  disabled={isCurrent || busy}
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {isCurrent ? 'Seu plano' : busy ? 'Aplicando…' : 'Escolher plano'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
