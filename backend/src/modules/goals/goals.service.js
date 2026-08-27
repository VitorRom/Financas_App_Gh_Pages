import { AppError } from '../../shared/utils/errors.js';
import * as repo from './goals.repository.js';

function pmtFromFutureValue({ targetFinalValue, monthlyRatePct, months }) {
  const r = monthlyRatePct / 100;
  if (months <= 0) return 0;
  if (r === 0) return targetFinalValue / months;
  return (targetFinalValue * r) / (Math.pow(1 + r, months) - 1);
}

function buildInstallments({ startDate, years, monthlyRatePct, monthlyContribution }) {
  const months = years * 12;
  const r = monthlyRatePct / 100;
  const rows = [];
  let invested = 0;
  let balance = 0;

  for (let i = 0; i < months; i++) {
    const paymentDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, startDate.getDate());
    const interest = balance * r;
    invested += monthlyContribution;
    balance = balance + interest + monthlyContribution;

    rows.push({
      monthIndex: i + 1,
      paymentDate,
      monthLabel: paymentDate.toLocaleDateString('pt-BR', { month: 'long' }),
      contribution: monthlyContribution,
      ratePct: monthlyRatePct,
      investedTotal: invested,
      projectedBalance: balance,
      status: 'Pendente',
    });
  }

  return rows;
}

export function list(userId) {
  return repo.findAll(userId);
}

export async function create(userId, data) {
  const { name, years, monthlyRatePct, targetFinalValue, startDate } = data;
  const start = startDate || new Date();
  const months = years * 12;
  const monthlyContribution = pmtFromFutureValue({ targetFinalValue, monthlyRatePct, months });
  const installments = buildInstallments({ startDate: start, years, monthlyRatePct, monthlyContribution });

  return repo.create({
    name,
    years,
    monthlyRatePct,
    targetFinalValue,
    monthlyContribution,
    startDate: start,
    userId,
    installments: { createMany: { data: installments } },
  });
}

export async function remove(userId, id) {
  const existing = await repo.findById(id, userId);
  if (!existing) throw new AppError('Meta não encontrada', 404);
  return repo.remove(id);
}

export async function updateInstallment(userId, id, { status }) {
  const installment = await repo.findInstallmentById(id);
  if (!installment || installment.goal.userId !== userId) {
    throw new AppError('Parcela não encontrada', 404);
  }
  return repo.updateInstallment(id, { status });
}
