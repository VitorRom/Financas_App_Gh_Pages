import { calculateAveragePrice } from '../utils/investmentCalculations.js';

async function recalculateInvestment(prisma, investmentId) {
  const transactions = await prisma.investmentTransaction.findMany({
    where: { investmentId },
    orderBy: { transactionDate: 'asc' },
  });

  const { quantity, averagePrice } = calculateAveragePrice(transactions);

  await prisma.investment.update({
    where: { id: investmentId },
    data: {
      quantity,
      averagePrice: Math.round(averagePrice * 100) / 100,
      isActive: quantity > 0,
    },
  });
}

export const listTransactions = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar ownership
    const investment = await prisma.investment.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!investment) return res.status(404).json({ error: 'Investimento não encontrado' });

    const transactions = await prisma.investmentTransaction.findMany({
      where: { investmentId: id },
      orderBy: { transactionDate: 'desc' },
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createTransaction = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;
    const { type, quantity, unitPrice, totalAmount, fees, transactionDate, notes } = req.body;

    // Verificar ownership
    const investment = await prisma.investment.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!investment) return res.status(404).json({ error: 'Investimento não encontrado' });

    // Validações
    if (!type || !transactionDate) {
      return res.status(400).json({ error: 'Tipo e data são obrigatórios' });
    }

    if (new Date(transactionDate) > new Date()) {
      return res.status(400).json({ error: 'Data de transação não pode ser futura' });
    }

    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    const total = parseFloat(totalAmount) || qty * price;
    const txFees = parseFloat(fees) || 0;

    // Validar total vs quantity * price
    if (qty > 0 && price > 0) {
      const expected = qty * price + txFees;
      if (Math.abs(expected - total) > 0.01 && total !== 0) {
        // Warning, mas permitir
      }
    }

    // Verificar se resgate não excede quantidade
    if (type === 'RESGATE' && qty > Number(investment.quantity)) {
      return res.status(400).json({
        error: `Quantidade de resgate (${qty}) excede a quantidade atual (${Number(investment.quantity)})`,
      });
    }

    const tx = await prisma.investmentTransaction.create({
      data: {
        type,
        quantity: qty,
        unitPrice: price,
        totalAmount: total || qty * price,
        fees: txFees,
        transactionDate: new Date(transactionDate),
        notes: notes || null,
        investmentId: id,
        userId: req.user.id,
      },
    });

    // Recalcular preço médio e quantidade
    await recalculateInvestment(prisma, id);

    res.status(201).json(tx);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateTransaction = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.investmentTransaction.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Transação não encontrada' });

    const { type, quantity, unitPrice, totalAmount, fees, transactionDate, notes } = req.body;

    if (transactionDate && new Date(transactionDate) > new Date()) {
      return res.status(400).json({ error: 'Data de transação não pode ser futura' });
    }

    const updated = await prisma.investmentTransaction.update({
      where: { id },
      data: {
        ...(type !== undefined && { type }),
        ...(quantity !== undefined && { quantity: parseFloat(quantity) }),
        ...(unitPrice !== undefined && { unitPrice: parseFloat(unitPrice) }),
        ...(totalAmount !== undefined && { totalAmount: parseFloat(totalAmount) }),
        ...(fees !== undefined && { fees: parseFloat(fees) }),
        ...(transactionDate !== undefined && { transactionDate: new Date(transactionDate) }),
        ...(notes !== undefined && { notes: notes || null }),
      },
    });

    await recalculateInvestment(prisma, existing.investmentId);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteTransaction = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.investmentTransaction.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Transação não encontrada' });

    await prisma.investmentTransaction.delete({ where: { id } });
    await recalculateInvestment(prisma, existing.investmentId);

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
