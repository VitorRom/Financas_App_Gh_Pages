import { AppError } from '../../shared/utils/errors.js';
import * as repo from './maintenance.repository.js';

function resolveDateRange(range, startDate, endDate) {
  const now = new Date();
  if (range === 'last24h') return { start: new Date(now - 86_400_000), end: now };
  if (range === 'last7d') return { start: new Date(now - 7 * 86_400_000), end: now };
  if (range === 'last30d') return { start: new Date(now - 30 * 86_400_000), end: now };
  if (range === 'custom') {
    if (!startDate || !endDate) throw new AppError('startDate e endDate são obrigatórios para range custom', 400);
    return { start: startDate, end: endDate };
  }
  throw new AppError('Range inválido', 400);
}

export async function purge(userId, { range, startDate, endDate, accountId }) {
  const dateRange = resolveDateRange(range, startDate, endDate);
  const result = await repo.deleteTransactions(userId, dateRange, accountId);
  await repo.recomputeAccountBalances(userId);

  return {
    deleted: result.count,
    range,
    start: dateRange.start.toISOString(),
    end: dateRange.end.toISOString(),
    accountId: accountId || null,
    note: 'Saldos recalculados com base nas transações restantes.',
  };
}
