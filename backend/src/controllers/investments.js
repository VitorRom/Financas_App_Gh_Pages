import { calculateAveragePrice, calculateProfitability } from '../utils/investmentCalculations.js';
import { getQuoteForAsset } from '../services/brapi.js';

export const listInvestments = (prisma) => async (req, res) => {
  try {
    const { assetType, broker, isActive } = req.query;
    const where = { userId: req.user.id };

    if (assetType) where.assetType = assetType;
    if (broker) where.broker = { contains: broker, mode: 'insensitive' };
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const investments = await prisma.investment.findMany({
      where,
      include: { account: true },
      orderBy: { createdAt: 'desc' },
    });

    // Enriquecer com rentabilidade
    const enriched = investments.map((inv) => {
      const price = inv.currentPrice ?? inv.averagePrice;
      const { absoluteGain, percentageGain } = calculateProfitability(inv, price);
      const currentValue = Number(inv.quantity) * Number(price);
      return { ...inv, currentValue, absoluteGain, percentageGain };
    });

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getInvestment = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;

    const investment = await prisma.investment.findFirst({
      where: { id, userId: req.user.id },
      include: {
        account: true,
        transactions: { orderBy: { transactionDate: 'desc' } },
      },
    });

    if (!investment) return res.status(404).json({ error: 'Investimento não encontrado' });

    const price = investment.currentPrice ?? investment.averagePrice;
    const { absoluteGain, percentageGain } = calculateProfitability(investment, price);
    const currentValue = Number(investment.quantity) * Number(price);

    res.json({ ...investment, currentValue, absoluteGain, percentageGain });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createInvestment = (prisma) => async (req, res) => {
  try {
    const {
      assetType, ticker, name, broker, accountId,
      indexer, interestRate, maturityDate, liquidityDays,
      purchaseDate, notes,
    } = req.body;

    if (!assetType || !name) {
      return res.status(400).json({ error: 'Tipo de ativo e nome são obrigatórios' });
    }

    if (!purchaseDate) {
      return res.status(400).json({ error: 'Data de compra é obrigatória' });
    }

    // Validações por tipo
    if (['ACAO', 'FII', 'ETF', 'CRIPTO'].includes(assetType) && !ticker) {
      return res.status(400).json({ error: 'Ticker é obrigatório para este tipo de ativo' });
    }

    if (assetType === 'RENDA_FIXA' || assetType === 'TESOURO_DIRETO') {
      if (!indexer) return res.status(400).json({ error: 'Indexador é obrigatório para renda fixa' });
      if (interestRate === undefined || interestRate === null) {
        return res.status(400).json({ error: 'Taxa é obrigatória para renda fixa' });
      }
      if (!maturityDate) return res.status(400).json({ error: 'Data de vencimento é obrigatória para renda fixa' });
    }

    const investment = await prisma.investment.create({
      data: {
        assetType,
        ticker: ticker || null,
        name,
        broker: broker || null,
        accountId: accountId || null,
        indexer: indexer || null,
        interestRate: interestRate != null ? parseFloat(interestRate) : null,
        maturityDate: maturityDate ? new Date(maturityDate) : null,
        liquidityDays: liquidityDays != null ? parseInt(liquidityDays) : null,
        purchaseDate: new Date(purchaseDate),
        notes: notes || null,
        userId: req.user.id,
      },
      include: { account: true },
    });

    res.status(201).json(investment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateInvestment = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.investment.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Investimento não encontrado' });

    const {
      assetType, ticker, name, broker, accountId,
      indexer, interestRate, maturityDate, liquidityDays,
      purchaseDate, notes, isActive,
    } = req.body;

    const investment = await prisma.investment.update({
      where: { id },
      data: {
        ...(assetType !== undefined && { assetType }),
        ...(ticker !== undefined && { ticker: ticker || null }),
        ...(name !== undefined && { name }),
        ...(broker !== undefined && { broker: broker || null }),
        ...(accountId !== undefined && { accountId: accountId || null }),
        ...(indexer !== undefined && { indexer: indexer || null }),
        ...(interestRate !== undefined && { interestRate: interestRate != null ? parseFloat(interestRate) : null }),
        ...(maturityDate !== undefined && { maturityDate: maturityDate ? new Date(maturityDate) : null }),
        ...(liquidityDays !== undefined && { liquidityDays: liquidityDays != null ? parseInt(liquidityDays) : null }),
        ...(purchaseDate !== undefined && { purchaseDate: new Date(purchaseDate) }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { account: true },
    });

    res.json(investment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteInvestment = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.investment.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Investimento não encontrado' });

    await prisma.investment.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const refreshPrice = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;

    const investment = await prisma.investment.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!investment) return res.status(404).json({ error: 'Investimento não encontrado' });

    const quote = await getQuoteForAsset(investment.assetType, investment.ticker);
    if (!quote || quote.error) {
      return res.json({
        ...investment,
        priceUpdate: { success: false, error: quote?.error || 'Sem cotação', stale: true },
      });
    }

    const updated = await prisma.investment.update({
      where: { id },
      data: {
        currentPrice: quote.price,
        lastPriceUpdate: new Date(),
      },
    });

    // Salvar no histórico
    await prisma.priceHistory.upsert({
      where: {
        ticker_date: {
          ticker: investment.ticker,
          date: new Date(new Date().toISOString().split('T')[0]),
        },
      },
      update: { price: quote.price },
      create: {
        ticker: investment.ticker,
        price: quote.price,
        date: new Date(new Date().toISOString().split('T')[0]),
        source: 'BRAPI',
      },
    });

    res.json({ ...updated, priceUpdate: { success: true, price: quote.price } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getSummary = (prisma) => async (req, res) => {
  try {
    const investments = await prisma.investment.findMany({
      where: { userId: req.user.id, isActive: true },
    });

    let totalInvested = 0;
    let totalCurrent = 0;
    const allocationByType = {};

    for (const inv of investments) {
      const qty = Number(inv.quantity);
      const avgPrice = Number(inv.averagePrice);
      const curPrice = Number(inv.currentPrice ?? inv.averagePrice);
      const invested = qty * avgPrice;
      const current = qty * curPrice;

      totalInvested += invested;
      totalCurrent += current;

      if (!allocationByType[inv.assetType]) allocationByType[inv.assetType] = 0;
      allocationByType[inv.assetType] += current;
    }

    const totalGain = totalCurrent - totalInvested;
    const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

    res.json({
      totalInvested: Math.round(totalInvested * 100) / 100,
      totalCurrent: Math.round(totalCurrent * 100) / 100,
      totalGain: Math.round(totalGain * 100) / 100,
      totalGainPct: Math.round(totalGainPct * 100) / 100,
      allocationByType,
      totalAssets: investments.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getEvolution = (prisma) => async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 12;
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);

    const transactions = await prisma.investmentTransaction.findMany({
      where: {
        userId: req.user.id,
        transactionDate: { gte: startDate },
      },
      orderBy: { transactionDate: 'asc' },
    });

    // Agrupar por mês
    const monthlyData = {};
    for (let i = 0; i <= months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - months + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[key] = { aportes: 0, resgates: 0, proventos: 0 };
    }

    for (const tx of transactions) {
      const d = new Date(tx.transactionDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[key]) continue;

      const amount = Number(tx.totalAmount);
      if (tx.type === 'APORTE') monthlyData[key].aportes += amount;
      else if (tx.type === 'RESGATE') monthlyData[key].resgates += amount;
      else if (['DIVIDENDO', 'JCP', 'RENDIMENTO'].includes(tx.type)) {
        monthlyData[key].proventos += amount;
      }
    }

    // Patrimônio atual para o último mês
    const investments = await prisma.investment.findMany({
      where: { userId: req.user.id, isActive: true },
    });

    const currentTotal = investments.reduce((sum, inv) => {
      return sum + Number(inv.quantity) * Number(inv.currentPrice ?? inv.averagePrice);
    }, 0);

    const evolution = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      ...data,
    }));

    res.json({ evolution, currentTotal: Math.round(currentTotal * 100) / 100 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllocation = (prisma) => async (req, res) => {
  try {
    const investments = await prisma.investment.findMany({
      where: { userId: req.user.id, isActive: true },
    });

    const byType = {};
    const byBroker = {};
    const byTicker = {};

    for (const inv of investments) {
      const value = Number(inv.quantity) * Number(inv.currentPrice ?? inv.averagePrice);

      if (!byType[inv.assetType]) byType[inv.assetType] = 0;
      byType[inv.assetType] += value;

      const broker = inv.broker || 'Não informada';
      if (!byBroker[broker]) byBroker[broker] = 0;
      byBroker[broker] += value;

      const label = inv.ticker || inv.name;
      if (!byTicker[label]) byTicker[label] = 0;
      byTicker[label] += value;
    }

    res.json({ byType, byBroker, byTicker });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getDividends = (prisma) => async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const transactions = await prisma.investmentTransaction.findMany({
      where: {
        userId: req.user.id,
        type: { in: ['DIVIDENDO', 'JCP', 'RENDIMENTO'] },
        transactionDate: { gte: startDate, lte: endDate },
      },
      include: { investment: { select: { name: true, ticker: true } } },
      orderBy: { transactionDate: 'asc' },
    });

    const byMonth = {};
    for (let m = 0; m < 12; m++) {
      byMonth[m + 1] = { total: 0, items: [] };
    }

    for (const tx of transactions) {
      const month = new Date(tx.transactionDate).getMonth() + 1;
      byMonth[month].total += Number(tx.totalAmount);
      byMonth[month].items.push({
        id: tx.id,
        type: tx.type,
        amount: Number(tx.totalAmount),
        date: tx.transactionDate,
        asset: tx.investment.ticker || tx.investment.name,
      });
    }

    const totalYear = Object.values(byMonth).reduce((s, m) => s + m.total, 0);

    res.json({ year, byMonth, totalYear: Math.round(totalYear * 100) / 100 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
