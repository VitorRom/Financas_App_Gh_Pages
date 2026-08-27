function resolveRangeToDates(range, startDate, endDate) {
  const now = new Date();

  if (range === 'last24h') {
    return { start: new Date(now.getTime() - 24 * 60 * 60 * 1000), end: now };
  }
  if (range === 'last7d') {
    return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: now };
  }
  if (range === 'last30d') {
    return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: now };
  }
  if (range === 'custom') {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) return null;
    return { start, end };
  }
  return null;
}

async function recomputeAllAccountBalances(prisma, userId) {
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true },
  });

  for (const acc of accounts) {
    const income = await prisma.transaction.aggregate({
      where: { accountId: acc.id, type: 'income', userId },
      _sum: { amount: true },
    });
    const expense = await prisma.transaction.aggregate({
      where: { accountId: acc.id, type: 'expense', userId },
      _sum: { amount: true },
    });

    const balance = (income._sum.amount || 0) - (expense._sum.amount || 0);
    await prisma.account.update({ where: { id: acc.id }, data: { balance } });
  }
}

export const purgeData = (prisma) => async (req, res) => {
  try {
    const { range, startDate, endDate, accountId } = req.body || {};
    const dates = resolveRangeToDates(range, startDate, endDate);
    if (!dates) {
      return res.status(400).json({ error: 'Range inválido. Use last24h/last7d/last30d/custom.' });
    }

    const where = {
      userId: req.user.id,
      date: { gte: dates.start, lte: dates.end },
    };
    if (accountId) where.accountId = accountId;

    const result = await prisma.transaction.deleteMany({ where });
    await recomputeAllAccountBalances(prisma, req.user.id);

    return res.json({
      deleted: result.count,
      range,
      start: dates.start.toISOString(),
      end: dates.end.toISOString(),
      accountId: accountId || null,
      note: 'Saldos recalculados com base nas transações restantes.',
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};