import prisma from '../../shared/lib/prisma.js';

export function deleteTransactions(userId, dateRange, accountId) {
  const where = { userId, date: { gte: dateRange.start, lte: dateRange.end } };
  if (accountId) where.accountId = accountId;
  return prisma.transaction.deleteMany({ where });
}

export async function recomputeAccountBalances(userId) {
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true },
  });

  for (const acc of accounts) {
    const [income, expense] = await Promise.all([
      prisma.transaction.aggregate({
        where: { accountId: acc.id, type: 'income', userId },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { accountId: acc.id, type: 'expense', userId },
        _sum: { amount: true },
      }),
    ]);

    const balance = (Number(income._sum.amount) || 0) - (Number(expense._sum.amount) || 0);
    await prisma.account.update({ where: { id: acc.id }, data: { balance } });
  }
}
