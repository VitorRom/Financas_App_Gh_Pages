// Controller para contas

export const getAccounts = (prisma) => async (req, res) => {
  try {
    const accounts = await prisma.account.findMany({
      where: { userId: req.user.id },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAccount = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;

    const account = await prisma.account.findFirst({
      where: { id, userId: req.user.id },
      include: {
        transactions: {
          take: 20,
          orderBy: { date: 'desc' },
          include: { category: true },
        },
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createAccount = (prisma) => async (req, res) => {
  try {
    const { name, type, balance, color } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    const parsedBalance = balance ? parseFloat(balance) : 0;
    const normalizedBalance = type === 'credit_card' ? -Math.abs(parsedBalance) : parsedBalance;

    const account = await prisma.account.create({
      data: {
        name,
        type,
        balance: normalizedBalance,
        color: color || '#10b981',
        userId: req.user.id,
      },
    });

    res.status(201).json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateAccount = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, balance, color } = req.body;

    const existingAccount = await prisma.account.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existingAccount) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const parsedBalance = balance !== undefined ? parseFloat(balance) : undefined;
    const normalizedBalance =
      parsedBalance !== undefined && type === 'credit_card' ? -Math.abs(parsedBalance) : parsedBalance;

    const account = await prisma.account.update({
      where: { id },
      data: {
        name,
        type,
        balance: normalizedBalance,
        color,
      },
    });

    res.json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteAccount = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;

    const existingAccount = await prisma.account.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existingAccount) {
      return res.status(404).json({ error: 'Account not found' });
    }

    await prisma.account.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};