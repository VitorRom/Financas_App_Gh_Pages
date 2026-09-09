import { z } from 'zod';

export const purgeSchema = z.object({
  range: z.enum(['last24h', 'last7d', 'last30d', 'custom'], { error: 'Período inválido. Use last24h, last7d, last30d ou custom.' }),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  accountId: z.string().uuid().optional(),
});
