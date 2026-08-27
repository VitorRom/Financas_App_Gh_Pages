import { AppError } from '../../shared/utils/errors.js';
import * as repo from './planning.repository.js';

export function list(userId) {
  return repo.findAll(userId);
}

export function create(userId, data) {
  return repo.create({ ...data, userId });
}

export async function update(userId, id, data) {
  const existing = await repo.findById(id, userId);
  if (!existing) throw new AppError('Item não encontrado', 404);
  return repo.update(id, data);
}

export async function remove(userId, id) {
  const existing = await repo.findById(id, userId);
  if (!existing) throw new AppError('Item não encontrado', 404);
  return repo.remove(id);
}
