// Cálculos de rentabilidade e projeção de investimentos

/**
 * Calcula preço médio ponderado a partir de transações.
 * Aportes aumentam a posição; resgates reduzem a quantidade mas mantêm o preço médio.
 */
export function calculateAveragePrice(transactions) {
  let totalQuantity = 0;
  let totalCost = 0;

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.transactionDate) - new Date(b.transactionDate)
  );

  for (const tx of sorted) {
    const qty = Number(tx.quantity);
    const price = Number(tx.unitPrice);
    const fees = Number(tx.fees || 0);

    switch (tx.type) {
      case 'APORTE': {
        totalCost += qty * price + fees;
        totalQuantity += qty;
        break;
      }
      case 'RESGATE': {
        if (totalQuantity > 0) {
          const avgPrice = totalCost / totalQuantity;
          totalQuantity -= qty;
          totalCost = totalQuantity * avgPrice;
        }
        break;
      }
      case 'BONIFICACAO':
      case 'DESDOBRAMENTO': {
        // Aumenta quantidade sem alterar custo total
        totalQuantity += qty;
        break;
      }
      case 'GRUPAMENTO': {
        // Reduz quantidade sem alterar custo total
        totalQuantity -= qty;
        break;
      }
      // DIVIDENDO, JCP, RENDIMENTO não alteram posição
      default:
        break;
    }
  }

  const averagePrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;
  return { quantity: totalQuantity, averagePrice };
}

/**
 * Taxa contratada média ponderada pelos aportes (ex.: IPCA+7,10 e IPCA+7,30).
 */
export function calculateAverageInterestRate(transactions) {
  let qty = 0;
  let weighted = 0;

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.transactionDate) - new Date(b.transactionDate)
  );

  for (const tx of sorted) {
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

/**
 * Calcula rentabilidade de um investimento.
 */
export function calculateProfitability(investment, currentPrice) {
  const qty = Number(investment.quantity);
  const avgPrice = Number(investment.averagePrice);
  const price = Number(currentPrice);

  if (qty <= 0 || avgPrice <= 0) {
    return { absoluteGain: 0, percentageGain: 0 };
  }

  const investedAmount = qty * avgPrice;
  const currentAmount = qty * price;
  const absoluteGain = currentAmount - investedAmount;
  const percentageGain = (absoluteGain / investedAmount) * 100;

  return { absoluteGain, percentageGain };
}

/**
 * Projeta rendimento de renda fixa baseado no indexador.
 */
export function calculateFixedIncomeYield(principal, rate, indexer, startDate, endDate, indexValue) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end - start;
  const years = diffMs / (1000 * 60 * 60 * 24 * 365.25);

  let annualRate;

  switch (indexer) {
    case 'PRE':
      annualRate = rate / 100;
      break;
    case 'CDI':
    case 'SELIC':
      // rate é percentual do indexador (ex: 110 = 110% do CDI)
      annualRate = (rate / 100) * ((indexValue || 13.25) / 100);
      break;
    case 'IPCA':
    case 'IGPM':
      // rate é spread acima do indexador (ex: 5.5 = IPCA + 5.5%)
      annualRate = ((indexValue || 4.5) + rate) / 100;
      break;
    default:
      annualRate = rate / 100;
  }

  const projectedValue = principal * Math.pow(1 + annualRate, years);
  const gain = projectedValue - principal;

  return { projectedValue, gain, annualRate: annualRate * 100 };
}

/**
 * Compara retorno do investimento com retorno de um índice.
 */
export function compareWithIndex(investmentReturn, indexReturn) {
  const outperformance = investmentReturn - indexReturn;
  const percentOfIndex = indexReturn !== 0 ? (investmentReturn / indexReturn) * 100 : 0;
  return { outperformance, percentOfIndex };
}

/**
 * Projeção de meta com juros compostos e aporte mensal.
 * FV = P(1+r)^n + PMT * [((1+r)^n - 1) / r]
 */
export function projectGoal(currentAmount, monthlyContribution, annualRate, months) {
  const r = annualRate / 100 / 12; // taxa mensal
  const projections = [];
  let balance = Number(currentAmount);

  for (let i = 1; i <= months; i++) {
    const interest = balance * r;
    balance = balance + interest + Number(monthlyContribution);
    projections.push({
      month: i,
      balance: Math.round(balance * 100) / 100,
      invested: Number(currentAmount) + Number(monthlyContribution) * i,
    });
  }

  return projections;
}
