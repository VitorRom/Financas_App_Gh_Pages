import { AppError } from '../../shared/utils/errors.js';
import { assertWithinPlanLimit } from '../../shared/utils/planLimits.js';
import * as repo from './transactions.repository.js';

/**
 * Garante que a conta e a categoria informadas pertencem a quem está autenticado.
 * Sem isso, o corpo da requisição poderia apontar para recursos de outro usuário —
 * e o ajuste de saldo alteraria a conta alheia.
 */
async function assertOwnsRelations(userId, { accountId, categoryId }) {
  if (accountId) {
    const account = await repo.findAccountForUser(accountId, userId);
    if (!account) throw new AppError('Conta não encontrada', 404);
  }

  if (categoryId) {
    const category = await repo.findCategoryForUser(categoryId, userId);
    if (!category) throw new AppError('Categoria não encontrada', 404);
  }
}

export function list(userId, filters) {
  return repo.findAll(userId, filters);
}

export async function findById(userId, id) {
  const tx = await repo.findById(id, userId);
  if (!tx) throw new AppError('Transação não encontrada', 404);
  return tx;
}

export async function create(userId, data) {
  await assertOwnsRelations(userId, data);
  await assertWithinPlanLimit(
    userId,
    'maxTransactions',
    () => repo.countByUser(userId),
    'transações',
  );

  return repo.createWithBalance({
    description: data.description,
    amount: data.amount,
    type: data.type,
    date: data.date || new Date(),
    categoryId: data.categoryId ?? null,
    accountId: data.accountId ?? null,
    notes: data.notes,
    userId,
  });
}

export async function update(userId, id, data) {
  const previous = await repo.findById(id, userId);
  if (!previous) throw new AppError('Transação não encontrada', 404);

  await assertOwnsRelations(userId, data);

  return repo.updateWithBalance(
    id,
    {
      description: data.description,
      amount: data.amount !== undefined ? data.amount : undefined,
      type: data.type,
      date: data.date,
      categoryId: data.categoryId !== undefined ? (data.categoryId ?? null) : undefined,
      accountId: data.accountId !== undefined ? (data.accountId ?? null) : undefined,
      notes: data.notes,
    },
    previous,
  );
}

export async function remove(userId, id) {
  const previous = await repo.findById(id, userId);
  if (!previous) throw new AppError('Transação não encontrada', 404);

  return repo.removeWithBalance(previous);
}
