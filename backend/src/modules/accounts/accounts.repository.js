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

/** Posições ativas vinculadas a alguma conta, para calcular o saldo de investimento. */
export function findLinkedInvestments(userId) {
  return prisma.investment.findMany({
    where: { userId, isActive: true, accountId: { not: null } },
    select: { accountId: true, quantity: true, averagePrice: true, currentPrice: true },
  });
}

export function countByUser(userId) {
  return prisma.account.count({ where: { userId } });
}

export function countTransactions(accountId) {
  return prisma.transaction.count({ where: { accountId } });
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
