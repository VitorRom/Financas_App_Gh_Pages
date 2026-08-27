import prisma from '../../shared/lib/prisma.js';

const planInclude = { plan: true };

export function findAllActivePlans() {
  return prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
  });
}

export function findPlanById(id) {
  return prisma.plan.findUnique({ where: { id } });
}

export function findFreePlan() {
  return prisma.plan.findUnique({ where: { name: 'free' } });
}

export function findByUserId(userId) {
  return prisma.subscription.findUnique({
    where: { userId },
    include: planInclude,
  });
}

export function upsertSubscription(userId, planId, status) {
  return prisma.subscription.upsert({
    where: { userId },
    update: { planId, status },
    create: { userId, planId, status },
    include: planInclude,
  });
}
