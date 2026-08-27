import prisma from '../../shared/lib/prisma.js';

export function findAll(userId, filters = {}) {
  const where = { userId };
  if (filters.assetType) where.assetType = filters.assetType;
  if (filters.broker) where.broker = { contains: filters.broker, mode: 'insensitive' };
  if (filters.isActive !== undefined) where.isActive = filters.isActive === 'true';

  return prisma.investment.findMany({
    where,
    include: { account: true },
    orderBy: { createdAt: 'desc' },
  });
}

export function findById(id, userId) {
  return prisma.investment.findFirst({
    where: { id, userId },
    include: {
      account: true,
      transactions: { orderBy: { transactionDate: 'desc' } },
    },
  });
}

export function findActiveWithTicker(userId) {
  return prisma.investment.findMany({
    where: { userId, isActive: true, ticker: { not: null } },
  });
}

export function findActive(userId) {
  return prisma.investment.findMany({
    where: { userId, isActive: true },
  });
}

export function create(data) {
  return prisma.investment.create({
    data,
    include: { account: true },
  });
}

export function update(id, data) {
  return prisma.investment.update({
    where: { id },
    data,
    include: { account: true },
  });
}

export function remove(id) {
  return prisma.investment.delete({ where: { id } });
}

// Transações de investimento
export function findTransactions(investmentId) {
  return prisma.investmentTransaction.findMany({
    where: { investmentId },
    orderBy: { transactionDate: 'desc' },
  });
}

export function findTransactionsByUser(userId, filters = {}) {
  const where = { userId };
  if (filters.types) where.type = { in: filters.types };
  if (filters.dateGte) where.transactionDate = { ...(where.transactionDate || {}), gte: filters.dateGte };
  if (filters.dateLte) where.transactionDate = { ...(where.transactionDate || {}), lte: filters.dateLte };

  return prisma.investmentTransaction.findMany({
    where,
    include: { investment: { select: { name: true, ticker: true } } },
    orderBy: { transactionDate: 'asc' },
  });
}

export function findTransactionById(id, userId) {
  return prisma.investmentTransaction.findFirst({ where: { id, userId } });
}

export function createTransaction(data) {
  return prisma.investmentTransaction.create({ data });
}

export function updateTransaction(id, data) {
  return prisma.investmentTransaction.update({ where: { id }, data });
}

export function deleteTransaction(id) {
  return prisma.investmentTransaction.delete({ where: { id } });
}

export function findAllTransactions(investmentId) {
  return prisma.investmentTransaction.findMany({
    where: { investmentId },
    orderBy: { transactionDate: 'asc' },
  });
}

// Price history
export function upsertPriceHistory(ticker, date, price, source) {
  return prisma.priceHistory.upsert({
    where: { ticker_date: { ticker, date } },
    update: { price },
    create: { ticker, price, date, source },
  });
}
