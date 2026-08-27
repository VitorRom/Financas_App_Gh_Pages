import { AppError } from '../../shared/utils/errors.js';
import { projectGoal } from '../../utils/investmentCalculations.js';
import * as repo from './investment-goals.repository.js';

function enrichGoal(goal) {
  const progressPct = Number(goal.targetAmount) > 0
    ? (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100
    : 0;

  const now = new Date();
  const target = new Date(goal.targetDate);
  const monthsRemaining = Math.max(0,
    (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
  );

  return { ...goal, progressPct: Math.round(progressPct * 100) / 100, monthsRemaining };
}

export async function list(userId) {
  const goals = await repo.findAll(userId);
  return goals.map(enrichGoal);
}

export async function create(userId, data) {
  const { name, targetAmount, targetDate, monthlyContribution, expectedReturnRate, currentAmount, assetTypes } = data;

  if (!name || !targetAmount || !targetDate || !monthlyContribution || expectedReturnRate === undefined) {
    throw new AppError('Nome, valor alvo, data alvo, aporte mensal e taxa de retorno são obrigatórios', 400);
  }

  return repo.create({
    name,
    targetAmount: parseFloat(targetAmount),
    targetDate: new Date(targetDate),
    monthlyContribution: parseFloat(monthlyContribution),
    expectedReturnRate: parseFloat(expectedReturnRate),
    currentAmount: parseFloat(currentAmount || 0),
    assetTypes: assetTypes || [],
    userId,
  });
}

export async function update(userId, id, data) {
  const existing = await repo.findById(id, userId);
  if (!existing) throw new AppError('Meta não encontrada', 404);

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.targetAmount !== undefined) updateData.targetAmount = parseFloat(data.targetAmount);
  if (data.targetDate !== undefined) updateData.targetDate = new Date(data.targetDate);
  if (data.monthlyContribution !== undefined) updateData.monthlyContribution = parseFloat(data.monthlyContribution);
  if (data.expectedReturnRate !== undefined) updateData.expectedReturnRate = parseFloat(data.expectedReturnRate);
  if (data.currentAmount !== undefined) updateData.currentAmount = parseFloat(data.currentAmount);
  if (data.assetTypes !== undefined) updateData.assetTypes = data.assetTypes;

  return repo.update(id, updateData);
}

export async function remove(userId, id) {
  const existing = await repo.findById(id, userId);
  if (!existing) throw new AppError('Meta não encontrada', 404);
  return repo.remove(id);
}

export async function getProjection(userId, id) {
  const goal = await repo.findById(id, userId);
  if (!goal) throw new AppError('Meta não encontrada', 404);

  const now = new Date();
  const target = new Date(goal.targetDate);
  const months = Math.max(1,
    (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
  );

  const projections = projectGoal(
    Number(goal.currentAmount),
    Number(goal.monthlyContribution),
    Number(goal.expectedReturnRate),
    months
  );

  const finalBalance = projections[projections.length - 1]?.balance || 0;

  return {
    goal: enrichGoal(goal),
    projections,
    finalBalance,
    reachesGoal: finalBalance >= Number(goal.targetAmount),
    monthsToGoal: months,
  };
}
