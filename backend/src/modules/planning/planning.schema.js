import { z } from 'zod';

const emptyToUndefined = (v) => (v === '' || v == null ? undefined : v);

export const createPlanningItemSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  type: z.enum(['income', 'expense'], { required_error: 'Tipo inválido' }),
  dayOfMonth: z.coerce.number().int().min(1).max(31).default(1),
  monthsDuration: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
  startMonth: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(600).optional()),
});

export const updatePlanningItemSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  type: z.enum(['income', 'expense'], { required_error: 'Tipo inválido' }),
  dayOfMonth: z.coerce.number().int().min(1).max(31).default(1),
  monthsDuration: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
  startMonth: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(600).optional()),
});
