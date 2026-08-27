import prisma from '../../shared/lib/prisma.js';

export function findAll(userId) {
  return prisma.account.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { transactions: true } } },
  });
}

export function findById(id, userId) {
  return prisma.account.findFirst({
    where: { id, userId },
    include: {
      transactions: {
        take: 20,
        orderBy: { date: 'desc' },
        include: { category: true },
      },
    },
  });
}

export function create(data) {
  return prisma.account.create({ data });
}

export function update(id, data) {
  return prisma.account.update({ where: { id }, data });
}

export function remove(id) {
  return prisma.account.delete({ where: { id } });
}
