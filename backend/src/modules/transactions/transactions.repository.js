import prisma from '../../shared/lib/prisma.js';

const withRelations = { category: true, account: true };

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

  // `limit` evita que telas que só mostram as últimas transações precisem baixar
  // o histórico inteiro. Sem teto explícito o comportamento continua o de antes.
  const take = Number.parseInt(filters.limit, 10);

  return prisma.transaction.findMany({
    where,
    include: withRelations,
    orderBy: { date: 'desc' },
    ...(Number.isFinite(take) && take > 0 ? { take: Math.min(take, 500) } : {}),
  });
}

export function findById(id, userId) {
  return prisma.transaction.findFirst({
    where: { id, userId },
    include: withRelations,
  });
}

export function countByUser(userId) {
  return prisma.transaction.count({ where: { userId } });
}

/** Confirma que a conta pertence ao usuário antes de vinculá-la a uma transação. */
export function findAccountForUser(id, userId) {
  return prisma.account.findFirst({ where: { id, userId }, select: { id: true } });
}

/** Confirma que a categoria pertence ao usuário antes de vinculá-la a uma transação. */
export function findCategoryForUser(id, userId) {
  return prisma.category.findFirst({ where: { id, userId }, select: { id: true, type: true } });
}

function balanceDelta({ type, amount }) {
  return type === 'income' ? Number(amount) : -Number(amount);
}

/**
 * Cria a transação e ajusta o saldo da conta na mesma transação de banco,
 * para que nunca exista uma sem a outra.
 */
export function createWithBalance(data) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({ data, include: withRelations });

    if (created.accountId) {
      await tx.account.update({
        where: { id: created.accountId },
        data: { balance: { increment: balanceDelta(created) } },
      });
    }

    return created;
  });
}

/** Atualiza a transação revertendo o efeito antigo e aplicando o novo, atomicamente. */
export function updateWithBalance(id, data, previous) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.transaction.update({ where: { id }, data, include: withRelations });

    if (previous.accountId) {
      await tx.account.update({
        where: { id: previous.accountId },
        data: { balance: { increment: -balanceDelta(previous) } },
      });
    }

    if (updated.accountId) {
      await tx.account.update({
        where: { id: updated.accountId },
        data: { balance: { increment: balanceDelta(updated) } },
      });
    }

    return updated;
  });
}

/** Remove a transação e devolve o valor ao saldo da conta, atomicamente. */
export function removeWithBalance(previous) {
  return prisma.$transaction(async (tx) => {
    const removed = await tx.transaction.delete({ where: { id: previous.id } });

    if (previous.accountId) {
      await tx.account.update({
        where: { id: previous.accountId },
        data: { balance: { increment: -balanceDelta(previous) } },
      });
    }

    return removed;
  });
}
