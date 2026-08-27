import { z } from 'zod';

export const createTransactionSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória'),
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  type: z.enum(['income', 'expense'], { required_error: 'Tipo inválido' }),
  date: z.coerce.date().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
});

export const updateTransactionSchema = z.object({
  description: z.string().min(1).optional(),
  amount: z.coerce.number().positive().optional(),
  type: z.enum(['income', 'expense']).optional(),
  date: z.coerce.date().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
});
