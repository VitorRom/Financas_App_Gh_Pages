import prisma from '../../shared/lib/prisma.js';

export function findAll(userId) {
  return prisma.investmentGoal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export function findById(id, userId) {
  return prisma.investmentGoal.findFirst({ where: { id, userId } });
}

export function create(data) {
  return prisma.investmentGoal.create({ data });
}

export function update(id, data) {
  return prisma.investmentGoal.update({ where: { id }, data });
}

export function remove(id) {
  return prisma.investmentGoal.delete({ where: { id } });
}
