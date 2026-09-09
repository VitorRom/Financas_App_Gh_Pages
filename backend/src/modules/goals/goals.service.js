import { AppError } from '../../shared/utils/errors.js';
import * as repo from './goals.repository.js';

function pmtFromFutureValue({ targetFinalValue, monthlyRatePct, months }) {
  const r = monthlyRatePct / 100;
  if (months <= 0) return 0;
  if (r === 0) return targetFinalValue / months;
  return (targetFinalValue * r) / (Math.pow(1 + r, months) - 1);
}

/**
 * Soma meses preservando o mês de destino.
 * `new Date(ano, mês + n, 31)` transborda para o mês seguinte quando o mês de
 * destino é mais curto — uma meta iniciada em 31/01 pularia fevereiro inteiro.
 * Aqui o dia é limitado ao último dia do mês de destino.
 */
function addMonthsClamped(date, months) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDayOfTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDayOfTargetMonth));
  return target;
}

/** "janeiro de 2025" — com o ano, para não repetir o mesmo rótulo a cada 12 parcelas. */
function formatMonthLabel(date) {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function buildInstallments({ startDate, years, monthlyRatePct, monthlyContribution }) {
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
      monthIndex: i + 1,
      paymentDate,
      monthLabel: formatMonthLabel(paymentDate),
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
