/**
 * Cálculos financeiros do modo autônomo.
 *
 * Espelham `backend/src/utils/investmentCalculations.js` e `goals.service.js`. A
 * duplicação é inerente: no modo autônomo não existe servidor para consultar. Os
 * testes em `backend/tests/` cobrem as mesmas regras, então qualquer divergência
 * entre as duas implementações aparece lá.
 */

/** Preço médio ponderado a partir das transações de um ativo. */
export function calculateAveragePrice(transactions) {
  let totalQuantity = 0;
  let totalCost = 0;

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.transactionDate) - new Date(b.transactionDate),
  );

  for (const tx of sorted) {
    const qty = Number(tx.quantity) || 0;
    const price = Number(tx.unitPrice) || 0;
    const fees = Number(tx.fees) || 0;

    switch (tx.type) {
      case 'APORTE':
        totalCost += qty * price + fees;
        totalQuantity += qty;
        break;
      case 'RESGATE':
        if (totalQuantity > 0) {
          const avg = totalCost / totalQuantity;
          totalQuantity -= qty;
          totalCost = totalQuantity * avg;
        }
        break;
      case 'BONIFICACAO':
      case 'DESDOBRAMENTO':
        totalQuantity += qty;
        break;
      case 'GRUPAMENTO':
        totalQuantity -= qty;
        break;
      default:
        break; // DIVIDENDO, JCP e RENDIMENTO não alteram a posição
    }
  }

  return {
    quantity: totalQuantity,
    averagePrice: totalQuantity > 0 ? totalCost / totalQuantity : 0,
  };
}

/** Taxa contratada média, ponderada pela quantidade de cada aporte. */
export function calculateAverageInterestRate(transactions) {
  let qty = 0;
  let weighted = 0;

  for (const tx of transactions) {
    if (tx.type !== 'APORTE') continue;
    const rate = tx.interestRate != null ? Number(tx.interestRate) : null;
    if (rate == null || Number.isNaN(rate)) continue;
    const q = Number(tx.quantity) || 0;
    if (q <= 0) continue;
    weighted += rate * q;
    qty += q;
  }

  if (qty <= 0) return null;
  return Math.round((weighted / qty) * 10000) / 10000;
}

/** Aporte mensal necessário para chegar a um valor futuro (PMT). */
export function pmtFromFutureValue({ targetFinalValue, monthlyRatePct, months }) {
  const r = monthlyRatePct / 100;
  if (months <= 0) return 0;
  if (r === 0) return targetFinalValue / months;
  return (targetFinalValue * r) / (Math.pow(1 + r, months) - 1);
}

/**
 * Soma meses sem transbordar para o mês seguinte quando o dia não existe no destino
 * (31 de janeiro + 1 mês = 28 de fevereiro, não 3 de março).
 */
export function addMonthsClamped(date, months) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return target;
}

/** Cronograma de parcelas de uma meta, com juros compostos mensais. */
export function buildInstallments({ startDate, years, monthlyRatePct, monthlyContribution }) {
  const months = years * 12;
  const r = monthlyRatePct / 100;
  const rows = [];
  let invested = 0;
  let balance = 0;

  for (let i = 0; i < months; i++) {
    const paymentDate = addMonthsClamped(startDate, i);
    const interest = balance * r;
    invested += monthlyContribution;
    balance = balance + interest + monthlyContribution;

    rows.push({
      id: crypto.randomUUID(),
      monthIndex: i + 1,
      paymentDate: paymentDate.toISOString(),
      monthLabel: paymentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      contribution: monthlyContribution,
      ratePct: monthlyRatePct,
      investedTotal: invested,
      projectedBalance: balance,
      status: 'Pendente',
    });
  }

  return rows;
}

/** Projeção de patrimônio com aporte mensal constante. */
export function projectGoal(currentAmount, monthlyContribution, annualRate, months) {
  const r = annualRate / 100 / 12;
  const projections = [];
  let balance = Number(currentAmount) || 0;

  for (let i = 1; i <= months; i++) {
    balance = balance + balance * r + Number(monthlyContribution || 0);
    projections.push({
      month: i,
      balance: Math.round(balance * 100) / 100,
      invested: Number(currentAmount || 0) + Number(monthlyContribution || 0) * i,
    });
  }

  return projections;
}

export function round2(value) {
  return Math.round(value * 100) / 100;
}
