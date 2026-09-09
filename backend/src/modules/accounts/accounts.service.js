import { AppError } from '../../shared/utils/errors.js';
import { assertWithinPlanLimit } from '../../shared/utils/planLimits.js';
import prisma from '../../shared/lib/prisma.js';
import * as repo from './accounts.repository.js';

/**
 * Cartão de crédito guarda saldo negativo (é dívida); conta de investimento tem
 * saldo derivado das posições e por isso é sempre 0 no campo `balance`.
 */
function normalizeBalance(type, balance) {
  if (type === 'investment') return 0;
  if (type === 'credit_card') return -Math.abs(balance);
  return balance;
}

/**
 * Contas de investimento guardam `balance = 0`: o valor delas vem das posições dos
 * ativos, não de transações. Sem calcular isso, elas apareceriam zeradas em toda
 * tela que lista contas. `investedValue` carrega esse número junto da conta.
 */
export async function list(userId) {
  const accounts = await repo.findAll(userId);
  if (!accounts.some((a) => a.type === 'investment')) return accounts;

  const investments = await repo.findLinkedInvestments(userId);

  const valuePerAccount = new Map();
  for (const inv of investments) {
    // Preço atual quando há cotação; preço médio como alternativa.
    const price = Number(inv.currentPrice ?? inv.averagePrice);
    const current = valuePerAccount.get(inv.accountId) ?? 0;
    valuePerAccount.set(inv.accountId, current + Number(inv.quantity) * price);
  }

  return accounts.map((account) =>
    account.type === 'investment'
      ? {
          ...account,
          investedValue: Math.round((valuePerAccount.get(account.id) ?? 0) * 100) / 100,
        }
      : account,
  );
}

export async function findById(userId, id) {
  const account = await repo.findById(id, userId);
  if (!account) throw new AppError('Conta não encontrada', 404);
  return account;
}

export async function create(userId, { name, type, balance, color }) {
  await assertWithinPlanLimit(userId, 'maxAccounts', () => repo.countByUser(userId), 'contas');

  const normalized = normalizeBalance(type, balance);

  return repo.create({
    name,
    type,
    balance: normalized,
    initialBalance: normalized,
    color,
    userId,
  });
}

export async function update(userId, id, data) {
  const existing = await repo.findById(id, userId);
  if (!existing) throw new AppError('Conta não encontrada', 404);

  const updateData = { ...data };
  const finalType = data.type ?? existing.type;

  if (finalType === 'investment') {
    updateData.balance = 0;
    updateData.initialBalance = 0;
  } else if (data.balance !== undefined) {
    // `finalType` e não `data.type`: numa edição parcial o tipo pode não vir no corpo,
    // e sem isso um cartão de crédito voltaria a gravar saldo positivo.
    const normalized = normalizeBalance(finalType, data.balance);

    // O usuário está corrigindo o saldo atual. Desloca o saldo de abertura pelo mesmo
    // valor para manter a identidade `balance = initialBalance + soma das transações`.
    const delta = normalized - Number(existing.balance);
    updateData.balance = normalized;
    updateData.initialBalance = Number(existing.initialBalance) + delta;
  }

  return repo.update(id, updateData);
}

export async function remove(userId, id) {
  const existing = await repo.findById(id, userId);
  if (!existing) throw new AppError('Conta não encontrada', 404);

  // Excluir a conta deixaria as transações sem conta (onDelete: SetNull): elas
  // continuariam somando em receitas/despesas mas sumiriam do saldo, criando uma
  // diferença silenciosa no Dashboard. Melhor exigir a limpeza antes.
  const transactionCount = await repo.countTransactions(id);
  if (transactionCount > 0) {
    throw new AppError(
      `Esta conta tem ${transactionCount} ${transactionCount === 1 ? 'transação vinculada' : 'transações vinculadas'}. ` +
        'Exclua ou mova essas transações antes de remover a conta.',
      409,
    );
  }

  return repo.remove(id);
}

/**
 * Saldo de uma conta de investimento, derivado das posições dos ativos vinculados.
 */
export async function getDerivedBalance(userId, accountId) {
  const account = await repo.findById(accountId, userId);
  if (!account) throw new AppError('Conta não encontrada', 404);
  if (account.type !== 'investment') {
    throw new AppError('Saldo derivado só está disponível para contas de investimento', 400);
  }

  const [transactionsNet, investments] = await Promise.all([
    prisma.investmentTransaction.aggregate({
      where: { userId, investment: { accountId }, type: { in: ['APORTE', 'RESGATE'] } },
      _sum: { totalAmount: true },
    }),
    prisma.investment.findMany({
      where: { userId, accountId, isActive: true },
      select: { quantity: true, averagePrice: true, currentPrice: true },
    }),
  ]);

  // Soma ativo a ativo. Somar quantidades e preços separadamente e multiplicar os
  // totais dá um número sem sentido (10x R$5 + 1x R$100 viraria R$1.155 em vez de R$150).
  const positionsValue = investments.reduce((total, inv) => {
    const price = Number(inv.currentPrice ?? inv.averagePrice);
    return total + Number(inv.quantity) * price;
  }, 0);

  return {
    accountId,
    transactionsNet: Number(transactionsNet._sum.totalAmount || 0),
    positionsValue: Math.round(positionsValue * 100) / 100,
  };
}
