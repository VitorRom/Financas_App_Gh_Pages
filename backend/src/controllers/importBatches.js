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

export const listImportBatches = (prisma) => async (req, res) => {
  try {
    const { accountId } = req.query;
    const where = { userId: req.user.id };
    if (accountId) where.accountId = accountId;

    const batches = await prisma.importBatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        _count: { select: { transactions: true } },
        account: { select: { id: true, name: true } },
      },
    });
    res.json(batches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteImportBatch = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;
    const batch = await prisma.importBatch.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!batch) return res.status(404).json({ error: 'ImportBatch não encontrado' });

    const deletedTx = await prisma.transaction.deleteMany({ where: { importBatchId: id } });
    await prisma.importBatch.delete({ where: { id } });
    await recomputeAllAccountBalances(prisma, req.user.id);

    res.json({
      deletedTransactions: deletedTx.count,
      importBatchId: id,
      note: 'Importação removida. Saldos recalculados.',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};