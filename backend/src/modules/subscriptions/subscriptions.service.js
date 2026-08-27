import { AppError } from '../../shared/utils/errors.js';
import * as repo from './subscriptions.repository.js';

function parseFeatures(subscription) {
  return {
    ...subscription,
    plan: {
      ...subscription.plan,
      features: JSON.parse(subscription.plan.features || '{}'),
    },
  };
}

export async function getPlans() {
  const plans = await repo.findAllActivePlans();
  return plans.map((p) => ({ ...p, features: JSON.parse(p.features || '{}') }));
}

export async function getSubscription(userId) {
  const subscription = await repo.findByUserId(userId);
  if (!subscription) throw new AppError('Assinatura não encontrada', 404);
  return parseFeatures(subscription);
}

export async function subscribe(userId, planId) {
  const plan = await repo.findPlanById(planId);
  if (!plan?.isActive) throw new AppError('Plano não encontrado ou inativo', 400);

  const subscription = await repo.upsertSubscription(userId, planId, 'active');
  return parseFeatures(subscription);
}

export async function cancel(userId) {
  const freePlan = await repo.findFreePlan();
  if (!freePlan) throw new AppError('Plano gratuito não encontrado', 500);

  const subscription = await repo.upsertSubscription(userId, freePlan.id, 'canceled');
  return parseFeatures(subscription);
}
