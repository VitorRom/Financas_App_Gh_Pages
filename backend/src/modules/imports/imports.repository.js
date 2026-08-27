import prisma from '../../shared/lib/prisma.js';

export function findAccount(id, userId) {
  return prisma.account.findFirst({ where: { id, userId } });
}

export function createBatch(data) {
  return prisma.importBatch.create({ data });
}

export function loadMerchantRules(type, userId) {
  return prisma.merchantRule.findMany({
    where: { userId, enabled: true, OR: [{ type: null }, { type }] },
    include: { category: true },
  });
}

export function countDuplicates(userId, accountId, tx) {
  return prisma.transaction.count({
    where: {
      userId, accountId,
      date: tx.date, amount: tx.amount, type: tx.type, description: tx.description,
    },
  });
}

export function findCategory(name, type, userId) {
  return prisma.category.findFirst({ where: { name, type, userId } });
}

export function createCategory(data) {
  return prisma.category.create({ data });
}

export function createTransaction(data) {
  return prisma.transaction.create({ data });
}

export function adjustAccountBalance(accountId, delta) {
  return prisma.account.update({
    where: { id: accountId },
    data: { balance: { increment: delta } },
  });
}

export function markInternalTransfer(ids) {
  return prisma.transaction.updateMany({
    where: { id: { in: ids } },
    data: { internalTransfer: true },
  });
}

export function findTransferCandidates(userId, tx) {
  const start = new Date(tx.date.getTime() - 86_400_000);
  const end = new Date(tx.date.getTime() + 86_400_000);
  return prisma.transaction.findMany({
    where: {
      userId,
      type: tx.type === 'income' ? 'expense' : 'income',
      amount: tx.amount,
      internalTransfer: false,
      accountId: { not: tx.accountId || undefined },
      date: { gte: start, lte: end },
    },
    select: { id: true, description: true },
    take: 20,
  });
}

export function findBatches(userId, accountId) {
  const where = { userId };
  if (accountId) where.accountId = accountId;
  return prisma.importBatch.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      _count: { select: { transactions: true } },
      account: { select: { id: true, name: true } },
    },
  });
}

export function findBatchById(id, userId) {
  return prisma.importBatch.findFirst({ where: { id, userId } });
}

export function deleteBatchTransactions(importBatchId) {
  return prisma.transaction.deleteMany({ where: { importBatchId } });
}

export function deleteBatch(id) {
  return prisma.importBatch.delete({ where: { id } });
}

export async function recomputeAccountBalances(userId) {
  const accounts = await prisma.account.findMany({ where: { userId }, select: { id: true } });
  for (const acc of accounts) {
    const [income, expense] = await Promise.all([
      prisma.transaction.aggregate({ where: { accountId: acc.id, type: 'income', userId }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { accountId: acc.id, type: 'expense', userId }, _sum: { amount: true } }),
    ]);
    const balance = (Number(income._sum.amount) || 0) - (Number(expense._sum.amount) || 0);
    await prisma.account.update({ where: { id: acc.id }, data: { balance } });
  }
}
