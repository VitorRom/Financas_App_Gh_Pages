import { AppError } from '../../shared/utils/errors.js';
import * as repo from './planning.repository.js';

/**
 * Normaliza o mês de início para o primeiro dia do mês em UTC.
 *
 * Guardar em UTC evita que o mês mude de acordo com o fuso de quem lê: um
 * `2026-11-01T00:00-03:00` viraria 31/10 em UTC, e o item apareceria em outubro.
 */
function normalizeStartDate(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (typeof value === 'string') {
    const [year, month] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, 1));
  }

  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

/** Mês corrente em UTC — padrão quando o usuário não escolhe um mês de início. */
function currentMonthUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function buildData(data) {
  const startDate = normalizeStartDate(data.startDate);
  return {
    name: data.name,
    amount: data.amount,
    type: data.type,
    dayOfMonth: data.dayOfMonth,
    monthsDuration: data.monthsDuration ?? null,
    startDate: startDate ?? currentMonthUTC(),
  };
}

export function list(userId) {
  return repo.findAll(userId);
}

export function create(userId, data) {
  return repo.create({ ...buildData(data), userId });
}

export async function update(userId, id, data) {
  const existing = await repo.findById(id, userId);
  if (!existing) throw new AppError('Item não encontrado', 404);
  return repo.update(id, buildData(data));
}

export async function remove(userId, id) {
  const existing = await repo.findById(id, userId);
  if (!existing) throw new AppError('Item não encontrado', 404);
  return repo.remove(id);
}
