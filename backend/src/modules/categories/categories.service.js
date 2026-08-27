import { AppError } from '../../shared/utils/errors.js';
import * as repo from './categories.repository.js';

export function list(userId, { type } = {}) {
  return repo.findAll(userId, type);
}

export async function findById(userId, id) {
  const category = await repo.findById(id, userId);
  if (!category) throw new AppError('Categoria não encontrada', 404);
  return category;
}

export function create(userId, data) {
  return repo.create({ ...data, userId });
}

export async function update(userId, id, data) {
  const existing = await repo.findById(id, userId);
  if (!existing) throw new AppError('Categoria não encontrada', 404);
  return repo.update(id, data);
}

export async function remove(userId, id) {
  const existing = await repo.findById(id, userId);
  if (!existing) throw new AppError('Categoria não encontrada', 404);
  return repo.remove(id);
}
