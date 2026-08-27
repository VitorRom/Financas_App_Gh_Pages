import prisma from '../../shared/lib/prisma.js';

export function getTransactions(userId, dateFilter) {
  return prisma.transaction.findMany({
    where: { userId, ...(dateFilter ? { date: dateFilter } : {}) },
    include: { category: true },
  });
}

export function getAccounts(userId) {
  return prisma.account.findMany({ where: { userId } });
}

export function getYearlyTransactions(userId, year) {
  return prisma.transaction.findMany({
    where: {
      userId,
      date: {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`),
      },
    },
  });
}
