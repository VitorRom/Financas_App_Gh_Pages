import prisma from '../../shared/lib/prisma.js';

export function findAll(userId, filters = {}) {
  const { type, categoryId, accountId, startDate, endDate, search, excludeInternal } = filters;

  const where = { userId };
  if (type) where.type = type;
  if (categoryId) where.categoryId = categoryId;
  if (accountId) where.accountId = accountId;
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }
  if (search) where.description = { contains: search, mode: 'insensitive' };
  if (excludeInternal === 'true') where.internalTransfer = false;

  return prisma.transaction.findMany({
    where,
    include: { category: true, account: true },
    orderBy: { date: 'desc' },
  });
}

export function findById(id, userId) {
  return prisma.transaction.findFirst({
    where: { id, userId },
    include: { category: true, account: true },
  });
}

export function create(data) {
  return prisma.transaction.create({
    data,
    include: { category: true, account: true },
  });
}

export function update(id, data) {
  return prisma.transaction.update({
    where: { id },
    data,
    include: { category: true, account: true },
  });
}

export function remove(id) {
  return prisma.transaction.delete({ where: { id } });
}

export function adjustAccountBalance(accountId, amount) {
  return prisma.account.update({
    where: { id: accountId },
    data: { balance: { increment: amount } },
  });
}
