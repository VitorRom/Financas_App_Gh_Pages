import { AppError } from '../../shared/utils/errors.js';
import * as repo from './transactions.repository.js';

export function list(userId, filters) {
  return repo.findAll(userId, filters);
}

export async function findById(userId, id) {
  const tx = await repo.findById(id, userId);
  if (!tx) throw new AppError('Transação não encontrada', 404);
  return tx;
}

export async function create(userId, data) {
  const tx = await repo.create({
    description: data.description,
    amount: data.amount,
    type: data.type,
    date: data.date || new Date(),
    categoryId: data.categoryId ?? null,
    accountId: data.accountId ?? null,
    notes: data.notes,
    userId,
  });

  if (tx.accountId) {
    const delta = tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount);
    await repo.adjustAccountBalance(tx.accountId, delta);
  }

  return tx;
}

export async function update(userId, id, data) {
  const old = await repo.findById(id, userId);
  if (!old) throw new AppError('Transação não encontrada', 404);

  const tx = await repo.update(id, {
    description: data.description,
    amount: data.amount !== undefined ? data.amount : undefined,
    type: data.type,
    date: data.date,
    categoryId: data.categoryId !== undefined ? (data.categoryId ?? null) : undefined,
    accountId: data.accountId !== undefined ? (data.accountId ?? null) : undefined,
    notes: data.notes,
  });

  // Revert old balance effect
  if (old.accountId) {
    const revert = old.type === 'income' ? -Number(old.amount) : Number(old.amount);
    await repo.adjustAccountBalance(old.accountId, revert);
  }

  // Apply new balance effect
  if (tx.accountId) {
    const delta = tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount);
    await repo.adjustAccountBalance(tx.accountId, delta);
  }

  return tx;
}

export async function remove(userId, id) {
  const tx = await repo.findById(id, userId);
  if (!tx) throw new AppError('Transação não encontrada', 404);

  if (tx.accountId) {
    const revert = tx.type === 'income' ? -Number(tx.amount) : Number(tx.amount);
    await repo.adjustAccountBalance(tx.accountId, revert);
  }

  return repo.remove(id);
}
