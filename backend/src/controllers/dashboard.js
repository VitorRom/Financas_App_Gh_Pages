// Controller para dashboard

export const getSummary = (prisma) => async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const where = { userId: req.user.id };
    if (startDate || endDate) where.date = dateFilter;

    const transactions = await prisma.transaction.findMany({
      where,
      include: { category: true },
    });
    const nonInternal = transactions.filter((t) => !t.internalTransfer);

    // Number() converts Prisma.Decimal to JS number for arithmetic
    const totalIncome = nonInternal
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpense = nonInternal
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const balance = totalIncome - totalExpense;

    const expensesByCategory = {};
    nonInternal
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const categoryName = t.category?.name || 'Sem categoria';
        expensesByCategory[categoryName] = (expensesByCategory[categoryName] || 0) + Number(t.amount);
      });

    const accounts = await prisma.account.findMany({
      where: { userId: req.user.id },
    });
    const accountsBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

    res.json({
      totalIncome,
      totalExpense,
      balance,
      accountsBalance,
      expensesByCategory,
      transactionCount: transactions.length,
      internalTransferCount: transactions.length - nonInternal.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getMonthlyData = (prisma) => async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: req.user.id,
        date: {
          gte: new Date(`${targetYear}-01-01`),
          lte: new Date(`${targetYear}-12-31`),
        },
      },
    });

    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: new Date(targetYear, i, 1).toLocaleDateString('pt-BR', { month: 'short' }),
      income: 0,
      expense: 0,
    }));

    transactions.forEach((t) => {
      const month = new Date(t.date).getMonth();
      if (t.type === 'income') {
        monthlyData[month].income += Number(t.amount);
      } else {
        monthlyData[month].expense += Number(t.amount);
      }
    });

    res.json(monthlyData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
