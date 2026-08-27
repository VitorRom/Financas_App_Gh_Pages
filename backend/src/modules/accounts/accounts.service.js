import { AppError } from '../../shared/utils/errors.js';
import prisma from '../../shared/lib/prisma.js';
import * as repo from './accounts.repository.js';

export function list(userId) {
  return repo.findAll(userId);
}

export async function findById(userId, id) {
  const account = await repo.findById(id, userId);
  if (!account) throw new AppError('Conta não encontrada', 404);
  return account;
}

export function create(userId, { name, type, balance, color }) {
  // Contas de investimento têm saldo derivado das transações (sempre começa em 0)
  const normalizedBalance = type === 'investment'
    ? 0
    : type === 'credit_card' ? -Math.abs(balance) : balance;
  return repo.create({ name, type, balance: normalizedBalance, color, userId });
}

export async function update(userId, id, data) {
  const existing = await repo.findById(id, userId);
  if (!existing) throw new AppError('Conta não encontrada', 404);

  const updateData = { ...data };

  // Para contas de investimento, o saldo é derivado — ignora updates manuais
  const finalType = data.type ?? existing.type;
  if (finalType === 'investment') {
    updateData.balance = 0;
  } else if (data.balance !== undefined && data.type === 'credit_card') {
    updateData.balance = -Math.abs(data.balance);
  }

  return repo.update(id, updateData);
}

export async function remove(userId, id) {
  const existing = await repo.findById(id, userId);
  if (!existing) throw new AppError('Conta não encontrada', 404);
  return repo.remove(id);
}

/**
 * Calcula o saldo derivado de uma conta de investimento somando
 * (aportes - resgates) das transações dos investimentos vinculados a ela.
 */
export async function getDerivedBalance(userId, accountId) {
  const account = await repo.findById(accountId, userId);
  if (!account) throw new AppError('Conta não encontrada', 404);
  if (account.type !== 'investment') {
    throw new AppError('Saldo derivado só disponível para contas de investimento', 400);
  }

  const result = await prisma.investmentTransaction.aggregate({
    where: {
      userId,
      investment: { accountId },
      type: { in: ['APORTE', 'RESGATE'] },
    },
    _sum: { totalAmount: true },
  });

  const invested = await prisma.investment.aggregate({
    where: { userId, accountId, isActive: true },
    _sum: { quantity: true, averagePrice: true },
  });

  // Saldo atual estimado: soma (qtd * preço médio) − resgates já registrados
  const positionsValue = Number(invested._sum.quantity || 0) * Number(invested._sum.averagePrice || 0);

  return {
    accountId,
    transactionsNet: Number(result._sum.totalAmount || 0),
    positionsValue: Math.round(positionsValue * 100) / 100,
  };
}
