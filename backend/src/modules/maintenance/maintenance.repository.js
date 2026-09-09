import prisma from '../../shared/lib/prisma.js';

export function deleteTransactions(userId, dateRange, accountId) {
  const where = { userId, date: { gte: dateRange.start, lte: dateRange.end } };
  if (accountId) where.accountId = accountId;
  return prisma.transaction.deleteMany({ where });
}

export async function recomputeAccountBalances(userId) {
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true, type: true, initialBalance: true },
  });

  for (const acc of accounts) {
    // Conta de investimento tem saldo derivado das posições — nunca das transações.
    if (acc.type === 'investment') {
      await prisma.account.update({ where: { id: acc.id }, data: { balance: 0 } });
      continue;
    }

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

    // O saldo de abertura precisa entrar na conta: sem ele, apagar uma importação
    // zeraria o valor que o usuário informou ao criar a conta.
    const balance =
      Number(acc.initialBalance || 0) +
      (Number(income._sum.amount) || 0) -
      (Number(expense._sum.amount) || 0);

    await prisma.account.update({ where: { id: acc.id }, data: { balance } });
  }
}
