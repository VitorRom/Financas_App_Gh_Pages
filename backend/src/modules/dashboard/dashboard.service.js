import * as repo from './dashboard.repository.js';

/** Primeiro instante do mês corrente até o último — o padrão do resumo. */
function currentMonthRange() {
  const now = new Date();
  return {
    gte: new Date(now.getFullYear(), now.getMonth(), 1),
    lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

export async function getSummary(userId, { startDate, endDate, period } = {}) {
  // Sem intervalo, o padrão é o mês corrente. Antes o resumo somava todas as
  // transações já cadastradas, enquanto a interface rotulava o número como
  // "Este mês" — quanto mais tempo de uso, mais distante da verdade.
  let dateFilter = null;

  if (period === 'all') {
    dateFilter = null;
  } else if (startDate || endDate) {
    dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
  } else {
    dateFilter = currentMonthRange();
  }

  const [transactions, accounts] = await Promise.all([
    repo.getTransactions(userId, dateFilter),
    repo.getAccounts(userId),
  ]);

  const nonInternal = transactions.filter((t) => !t.internalTransfer);

  const totalIncome = nonInternal
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = nonInternal
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const expensesByCategory = {};
  nonInternal
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const name = t.category?.name || 'Sem categoria';
      expensesByCategory[name] = (expensesByCategory[name] || 0) + Number(t.amount);
    });

  // Contas de investimento representam patrimônio (posições em ativos) e não
  // compõem o saldo de caixa disponível, então são excluídas do total geral.
  const accountsBalance = accounts
    .filter((a) => a.type !== 'investment')
    .reduce((sum, a) => sum + Number(a.balance), 0);

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    accountsBalance,
    expensesByCategory,
    transactionCount: transactions.length,
    internalTransferCount: transactions.length - nonInternal.length,
    // O cliente precisa saber a que período os números se referem para rotulá-los.
    period: dateFilter
      ? { start: dateFilter.gte?.toISOString() ?? null, end: dateFilter.lte?.toISOString() ?? null }
      : null,
  };
}

export async function getMonthlyData(userId, year) {
  const targetYear = year ? parseInt(year) : new Date().getFullYear();
  const transactions = await repo.getYearlyTransactions(userId, targetYear);

  const monthlyData = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    monthName: new Date(targetYear, i, 1).toLocaleDateString('pt-BR', { month: 'short' }),
    income: 0,
    expense: 0,
  }));

  transactions.forEach((t) => {
    const month = new Date(t.date).getMonth();
    if (t.type === 'income') monthlyData[month].income += Number(t.amount);
    else monthlyData[month].expense += Number(t.amount);
  });

  return monthlyData;
}
