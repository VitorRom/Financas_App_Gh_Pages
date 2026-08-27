import prisma from '../../shared/lib/prisma.js';

export function findAll(userId) {
  return prisma.goal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { installments: { orderBy: { monthIndex: 'asc' } } },
  });
}

export function findById(id, userId) {
  return prisma.goal.findFirst({ where: { id, userId } });
}

export function create(data) {
  return prisma.goal.create({
    data,
    include: { installments: { orderBy: { monthIndex: 'asc' } } },
  });
}

export function remove(id) {
  return prisma.goal.delete({ where: { id } });
}

export function findInstallmentById(id) {
  return prisma.goalInstallment.findUnique({
    where: { id },
    include: { goal: true },
  });
}

export function updateInstallment(id, data) {
  return prisma.goalInstallment.update({ where: { id }, data });
}
