import prisma from '../../shared/lib/prisma.js';

const userInclude = { subscription: { include: { plan: true } } };

export function findByEmail(email) {
  return prisma.user.findUnique({ where: { email }, include: userInclude });
}

export function findById(id) {
  return prisma.user.findUnique({ where: { id }, include: userInclude });
}

export function findByEmailExcluding(email, excludeId) {
  return prisma.user.findFirst({
    where: { email, NOT: { id: excludeId } },
  });
}

export function create(data) {
  return prisma.user.create({ data, include: userInclude });
}

export function update(id, data) {
  return prisma.user.update({ where: { id }, data, include: userInclude });
}

export function findFreePlan() {
  return prisma.plan.findUnique({ where: { name: 'free' } });
}
