// Controller para transações

export const getTransactions = (prisma) => async (req, res) => {
  try {
    const { type, categoryId, accountId, startDate, endDate, search, excludeInternal } = req.query;

    const where = { userId: req.user.id };

    if (type) where.type = type;
    if (categoryId) where.categoryId = categoryId;
    if (accountId) where.accountId = accountId;

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    if (search) {
      where.description = { contains: search, mode: 'insensitive' };
    }

    if (excludeInternal === 'true') {
      where.internalTransfer = false;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: true,
        account: true,
      },
      orderBy: { date: 'desc' },
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getTransaction = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: req.user.id },
      include: {
        category: true,
        account: true,
      },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createTransaction = (prisma) => async (req, res) => {
  try {
    const { description, amount, type, date, categoryId, accountId, notes } = req.body;
    const normalizedCategoryId = categoryId || null;
    const normalizedAccountId = accountId || null;

    if (!description || !amount || !type) {
      return res.status(400).json({ error: 'Description, amount, and type are required' });
    }

    const transaction = await prisma.transaction.create({
      data: {
        description,
        amount: parseFloat(amount),
        type,
        date: date ? new Date(date) : new Date(),
        categoryId: normalizedCategoryId,
        accountId: normalizedAccountId,
        notes,
        userId: req.user.id,
      },
      include: {
        category: true,
        account: true,
      },
    });

    // Update account balance
    if (normalizedAccountId) {
      const balanceChange = type === 'income' ? parseFloat(amount) : -parseFloat(amount);
      await prisma.account.update({
        where: { id: normalizedAccountId },
        data: { balance: { increment: balanceChange } },
      });
    }

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateTransaction = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;
    const { description, amount, type, date, categoryId, accountId, notes } = req.body;
    const normalizedCategoryId = categoryId || null;
    const normalizedAccountId = accountId || null;

    // Get old transaction to revert account balance
    const oldTransaction = await prisma.transaction.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!oldTransaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        description,
        amount: amount !== undefined ? parseFloat(amount) : undefined,
        type,
        date: date ? new Date(date) : undefined,
        categoryId: normalizedCategoryId,
        accountId: normalizedAccountId,
        notes,
      },
      include: {
        category: true,
        account: true,
      },
    });

    // Update account balances
    if (oldTransaction.accountId) {
      const oldBalanceChange = oldTransaction.type === 'income' ? -oldTransaction.amount : oldTransaction.amount;
      await prisma.account.update({
        where: { id: oldTransaction.accountId },
        data: { balance: { increment: oldBalanceChange } },
      });
    }

    if (normalizedAccountId) {
      const newBalanceChange = type === 'income' ? parseFloat(amount) : -parseFloat(amount);
      await prisma.account.update({
        where: { id: normalizedAccountId },
        data: { balance: { increment: newBalanceChange } },
      });
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteTransaction = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;

    // Get transaction to revert account balance
    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Revert account balance
    if (transaction.accountId) {
      const balanceChange = transaction.type === 'income' ? -transaction.amount : transaction.amount;
      await prisma.account.update({
        where: { id: transaction.accountId },
        data: { balance: { increment: balanceChange } },
      });
    }

    await prisma.transaction.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};