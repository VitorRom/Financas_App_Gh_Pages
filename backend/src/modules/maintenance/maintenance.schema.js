import { z } from 'zod';

export const purgeSchema = z.object({
  range: z.enum(['last24h', 'last7d', 'last30d', 'custom'], { required_error: 'Range é obrigatório' }),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  accountId: z.string().uuid().optional(),
});
