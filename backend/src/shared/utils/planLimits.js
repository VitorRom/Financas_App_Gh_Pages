import prisma from '../lib/prisma.js';
import { AppError } from './errors.js';
import { env } from '../config/env.js';

/**
 * Limites de plano (maxTransactions / maxAccounts).
 *
 * Ficam DESLIGADOS por padrão: a aplicação nasceu como uso pessoal e o plano
 * gratuito (100 transações, 2 contas) travaria o próprio dono na primeira
 * importação de extrato. Para cobrar de verdade, defina ENFORCE_PLAN_LIMITS=true
 * — a checagem abaixo já está pronta e é aplicada na criação de contas e transações.
 */
export function planLimitsEnabled() {
  return env.ENFORCE_PLAN_LIMITS === true;
}

async function getPlan(userId) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });
  return subscription?.plan ?? null;
}

/**
 * @param {string} userId
 * @param {'maxTransactions'|'maxAccounts'} limitField
 * @param {() => Promise<number>} countCurrent
 * @param {string} label  usado na mensagem de erro
 */
export async function assertWithinPlanLimit(userId, limitField, countCurrent, label) {
  if (!planLimitsEnabled()) return;

  const plan = await getPlan(userId);
  const max = plan?.[limitField];
  if (max == null) return; // sem plano ou limite ilimitado

  const current = await countCurrent();
  if (current >= max) {
    throw new AppError(
      `Seu plano ${plan.displayName} permite até ${max} ${label}. Faça upgrade para adicionar mais.`,
      403,
    );
  }
}
