import { AppError } from '../../shared/utils/errors.js';
import { calculateAveragePrice, calculateAverageInterestRate, calculateProfitability } from '../../utils/investmentCalculations.js';
import { getQuoteForAsset } from '../../services/brapi.js';
import {
  buildTreasurySymbol,
  quoteReferenceDate,
  resolveTreasuryTicker,
} from '../../utils/treasurySymbols.js';
import * as repo from './investments.repository.js';
import * as accountsRepo from '../accounts/accounts.repository.js';

async function resolveTickerForQuote(investment) {
  if (investment.assetType === 'TESOURO_DIRETO') {
    return resolveTreasuryTicker(investment);
  }
  return investment.ticker || null;
}

async function persistQuoteUpdate(investmentId, ticker, quote) {
  const source = (quote.source || 'MARKET').slice(0, 40);
  const updated = await repo.update(investmentId, {
    ticker,
    currentPrice: quote.price,
    lastPriceUpdate: quoteReferenceDate(quote),
  });
  const today = new Date(new Date().toISOString().split('T')[0]);
  await repo.upsertPriceHistory(ticker, today, quote.price, source);
  return updated;
}

async function syncTreasuryMarketPrice(investmentId, investment) {
  const ticker = await resolveTreasuryTicker(investment);
  if (!ticker) return null;

  const quote = await getQuoteForAsset('TESOURO_DIRETO', ticker);
  if (!quote || quote.error || quote.price == null) return null;

  await persistQuoteUpdate(investmentId, ticker, quote);
  return quote;
}

function enrichInvestment(inv) {
  const price = inv.currentPrice ?? inv.averagePrice;
  const { absoluteGain, percentageGain } = calculateProfitability(inv, price);
  const currentValue = Number(inv.quantity) * Number(price);
  return { ...inv, currentValue, absoluteGain, percentageGain };
}

export async function list(userId, filters) {
  const investments = await repo.findAll(userId, filters);
  return investments.map(enrichInvestment);
}

export async function getById(userId, id) {
  const investment = await repo.findById(id, userId);
  if (!investment) throw new AppError('Investimento não encontrado', 404);
  return enrichInvestment(investment);
}

export async function create(userId, data) {
  const {
    assetType, ticker, name, broker, accountId,
    indexer, interestRate, maturityDate, liquidityDays,
    purchaseDate, notes,
  } = data;

  if (!assetType || !name) throw new AppError('Tipo de ativo e nome são obrigatórios', 400);
  if (!purchaseDate) throw new AppError('Data de compra é obrigatória', 400);

  if (['ACAO', 'FII', 'ETF', 'CRIPTO'].includes(assetType) && !ticker) {
    throw new AppError('Ticker é obrigatório para este tipo de ativo', 400);
  }

  if (['RENDA_FIXA', 'TESOURO_DIRETO'].includes(assetType)) {
    if (!indexer) throw new AppError('Indexador é obrigatório para renda fixa', 400);
    if (interestRate === undefined || interestRate === null) throw new AppError('Taxa é obrigatória para renda fixa', 400);
    if (!maturityDate) throw new AppError('Data de vencimento é obrigatória para renda fixa', 400);
  }

  // Se vinculado a uma conta de investimento e broker não foi informado,
  // sincroniza broker com o nome da conta
  let resolvedBroker = broker || null;
  if (accountId) {
    const account = await accountsRepo.findById(accountId, userId);
    if (!account) throw new AppError('Conta vinculada não encontrada', 404);
    if (account.type === 'investment' && !resolvedBroker) {
      resolvedBroker = account.name;
    }
  }

  let resolvedTicker = ticker || null;
  if (assetType === 'TESOURO_DIRETO') {
    resolvedTicker = await resolveTreasuryTicker({
      ticker,
      name,
      indexer,
      maturityDate,
      assetType,
    });
    if (!resolvedTicker) {
      resolvedTicker = buildTreasurySymbol({ indexer, maturityDate, name }) || ticker || null;
    }
  }

  const created = await repo.create({
    assetType,
    ticker: resolvedTicker,
    name,
    broker: resolvedBroker,
    accountId: accountId || null,
    indexer: indexer || null,
    interestRate: interestRate != null ? parseFloat(interestRate) : null,
    maturityDate: maturityDate ? new Date(maturityDate) : null,
    liquidityDays: liquidityDays != null ? parseInt(liquidityDays) : null,
    purchaseDate: new Date(purchaseDate),
    notes: notes || null,
    userId,
  });

  if (assetType === 'TESOURO_DIRETO') {
    try {
      await syncTreasuryMarketPrice(created.id, created);
      const refreshed = await repo.findById(created.id, userId);
      return enrichInvestment(refreshed);
    } catch (err) {
      console.error('Falha ao sincronizar cotação do Tesouro:', err.message);
      return created;
    }
  }

  return created;
}

export async function update(userId, id, data) {
  const existing = await repo.findById(id, userId);
  if (!existing) throw new AppError('Investimento não encontrado', 404);

  // Se accountId mudou para uma conta de investimento e broker não foi informado,
  // sincroniza broker com o nome da nova conta
  let resolvedBroker = data.broker;
  if (data.broker === undefined || data.broker === null || data.broker === '') {
    const accountIdToCheck = data.accountId !== undefined ? data.accountId : existing.accountId;
    if (accountIdToCheck) {
      const account = await accountsRepo.findById(accountIdToCheck, userId);
      if (account && account.type === 'investment') {
        resolvedBroker = account.name;
      } else {
        resolvedBroker = null;
      }
    } else {
      resolvedBroker = null;
    }
  }

  const updateData = {};
  if (data.assetType !== undefined) updateData.assetType = data.assetType;
  if (data.ticker !== undefined) updateData.ticker = data.ticker || null;
  if (data.name !== undefined) updateData.name = data.name;
  updateData.broker = resolvedBroker;
  if (data.accountId !== undefined) updateData.accountId = data.accountId || null;
  if (data.indexer !== undefined) updateData.indexer = data.indexer || null;
  if (data.interestRate !== undefined) updateData.interestRate = data.interestRate != null ? parseFloat(data.interestRate) : null;
  if (data.maturityDate !== undefined) updateData.maturityDate = data.maturityDate ? new Date(data.maturityDate) : null;
  if (data.liquidityDays !== undefined) updateData.liquidityDays = data.liquidityDays != null ? parseInt(data.liquidityDays) : null;
  if (data.purchaseDate !== undefined) updateData.purchaseDate = new Date(data.purchaseDate);
  if (data.notes !== undefined) updateData.notes = data.notes || null;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return repo.update(id, updateData);
}

export async function remove(userId, id) {
  const existing = await repo.findById(id, userId);
  if (!existing) throw new AppError('Investimento não encontrado', 404);
  return repo.remove(id);
}

export async function refreshPrice(userId, id) {
  const investment = await repo.findById(id, userId);
  if (!investment) throw new AppError('Investimento não encontrado', 404);

  const ticker = await resolveTickerForQuote(investment);
  if (!ticker) {
    return {
      ...enrichInvestment(investment),
      priceUpdate: { success: false, error: 'Não foi possível identificar o título para cotação' },
    };
  }

  const quote = await getQuoteForAsset(investment.assetType, ticker);
  if (!quote || quote.error || quote.price == null) {
    return {
      ...enrichInvestment(investment),
      priceUpdate: {
        success: false,
        error: quote?.error || 'Sem cotação oficial disponível',
        stale: true,
      },
    };
  }

  const updated = await persistQuoteUpdate(id, ticker, quote);
  return {
    ...enrichInvestment(updated),
    priceUpdate: { success: true, price: quote.price, source: quote.source },
  };
}

// Transações
async function recalculate(investmentId) {
  const transactions = await repo.findAllTransactions(investmentId);
  const { quantity, averagePrice } = calculateAveragePrice(transactions);
  const averageRate = calculateAverageInterestRate(transactions);
  await repo.update(investmentId, {
    quantity,
    averagePrice: Math.round(averagePrice * 100) / 100,
    isActive: quantity > 0,
    ...(averageRate != null ? { interestRate: averageRate } : {}),
  });
}

export async function listTransactions(userId, investmentId) {
  const investment = await repo.findById(investmentId, userId);
  if (!investment) throw new AppError('Investimento não encontrado', 404);
  return repo.findTransactions(investmentId);
}

export async function createTransaction(userId, investmentId, data) {
  const investment = await repo.findById(investmentId, userId);
  if (!investment) throw new AppError('Investimento não encontrado', 404);

  if (!data.type || !data.transactionDate) throw new AppError('Tipo e data são obrigatórios', 400);
  if (new Date(data.transactionDate) > new Date()) throw new AppError('Data de transação não pode ser futura', 400);

  const qty = parseFloat(data.quantity) || 0;
  const price = parseFloat(data.unitPrice) || 0;
  const fees = parseFloat(data.fees) || 0;
  const total = parseFloat(data.totalAmount) || qty * price;

  const isFixed = ['TESOURO_DIRETO', 'RENDA_FIXA'].includes(investment.assetType);
  let contractedRate = data.interestRate != null && data.interestRate !== ''
    ? parseFloat(data.interestRate)
    : null;
  if (data.type === 'APORTE' && isFixed) {
    if (contractedRate == null || Number.isNaN(contractedRate)) {
      contractedRate = investment.interestRate != null ? Number(investment.interestRate) : null;
    }
    if (investment.assetType === 'TESOURO_DIRETO' && (contractedRate == null || Number.isNaN(contractedRate))) {
      throw new AppError('Taxa contratada na compra é obrigatória para Tesouro Direto', 400);
    }
  }

  if (data.type === 'RESGATE' && qty > Number(investment.quantity)) {
    throw new AppError(`Quantidade de resgate (${qty}) excede a quantidade atual (${Number(investment.quantity)})`, 400);
  }

  const tx = await repo.createTransaction({
    type: data.type,
    quantity: qty,
    unitPrice: price,
    totalAmount: total || qty * price,
    fees,
    interestRate: data.type === 'APORTE' ? contractedRate : null,
    transactionDate: new Date(data.transactionDate),
    notes: data.notes || null,
    investmentId,
    userId,
  });

  await recalculate(investmentId);
  return tx;
}

export async function updateTransaction(userId, txId, data) {
  const existing = await repo.findTransactionById(txId, userId);
  if (!existing) throw new AppError('Transação não encontrada', 404);

  if (data.transactionDate && new Date(data.transactionDate) > new Date()) {
    throw new AppError('Data de transação não pode ser futura', 400);
  }

  const updateData = {};
  if (data.type !== undefined) updateData.type = data.type;
  if (data.quantity !== undefined) updateData.quantity = parseFloat(data.quantity);
  if (data.unitPrice !== undefined) updateData.unitPrice = parseFloat(data.unitPrice);
  if (data.totalAmount !== undefined) updateData.totalAmount = parseFloat(data.totalAmount);
  if (data.fees !== undefined) updateData.fees = parseFloat(data.fees);
  if (data.interestRate !== undefined) {
    updateData.interestRate = data.interestRate != null && data.interestRate !== ''
      ? parseFloat(data.interestRate)
      : null;
  }
  if (data.transactionDate !== undefined) updateData.transactionDate = new Date(data.transactionDate);
  if (data.notes !== undefined) updateData.notes = data.notes || null;

  const updated = await repo.updateTransaction(txId, updateData);
  await recalculate(existing.investmentId);
  return updated;
}

export async function deleteTransaction(userId, txId) {
  const existing = await repo.findTransactionById(txId, userId);
  if (!existing) throw new AppError('Transação não encontrada', 404);
  await repo.deleteTransaction(txId);
  await recalculate(existing.investmentId);
}

// Summary
export async function getSummary(userId) {
  const investments = await repo.findActive(userId);

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

  return {
    totalInvested: Math.round(totalInvested * 100) / 100,
    totalCurrent: Math.round(totalCurrent * 100) / 100,
    totalGain: Math.round(totalGain * 100) / 100,
    totalGainPct: Math.round(totalGainPct * 100) / 100,
    allocationByType,
    totalAssets: investments.length,
  };
}

export async function getEvolution(userId, months) {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);

  const transactions = await repo.findTransactionsByUser(userId, { dateGte: startDate });

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
    else if (['DIVIDENDO', 'JCP', 'RENDIMENTO'].includes(tx.type)) monthlyData[key].proventos += amount;
  }

  const investments = await repo.findActive(userId);
  const currentTotal = investments.reduce((sum, inv) => {
    return sum + Number(inv.quantity) * Number(inv.currentPrice ?? inv.averagePrice);
  }, 0);

  return {
    evolution: Object.entries(monthlyData).map(([month, data]) => ({ month, ...data })),
    currentTotal: Math.round(currentTotal * 100) / 100,
  };
}

export async function getAllocation(userId) {
  const investments = await repo.findActive(userId);
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

  return { byType, byBroker, byTicker };
}

export async function getDividends(userId, year) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);

  const transactions = await repo.findTransactionsByUser(userId, {
    types: ['DIVIDENDO', 'JCP', 'RENDIMENTO'],
    dateGte: startDate,
    dateLte: endDate,
  });

  const byMonth = {};
  for (let m = 1; m <= 12; m++) {
    byMonth[m] = { total: 0, items: [] };
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
  return { year, byMonth, totalYear: Math.round(totalYear * 100) / 100 };
}

export async function refreshAllPrices(userId) {
  const investments = await repo.findActive(userId);
  const results = [];

  for (const inv of investments) {
    const ticker = await resolveTickerForQuote(inv);
    if (!ticker) {
      if (inv.assetType !== 'TESOURO_DIRETO') continue;
      results.push({
        ticker: inv.name,
        success: false,
        error: 'Não foi possível identificar o título do Tesouro',
      });
      continue;
    }

    const quote = await getQuoteForAsset(inv.assetType, ticker);
    if (quote && !quote.error && quote.price != null) {
      await persistQuoteUpdate(inv.id, ticker, quote);
      results.push({ ticker, price: quote.price, source: quote.source, success: true });
    } else {
      results.push({
        ticker: ticker || inv.name,
        success: false,
        error: quote?.error || 'Sem cotação',
      });
    }
  }

  return { updated: results.filter((r) => r.success).length, total: results.length, results };
}
