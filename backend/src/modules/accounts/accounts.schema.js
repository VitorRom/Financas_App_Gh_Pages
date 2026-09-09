import { z } from 'zod';

export const ACCOUNT_TYPES = ['checking', 'savings', 'credit_card', 'cash', 'investment'];

export const createAccountSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(ACCOUNT_TYPES, { error: 'Tipo de conta inválido' }),
  balance: z.coerce.number().default(0),
  color: z.string().default('#10b981'),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(ACCOUNT_TYPES, { error: 'Tipo de conta inválido' }).optional(),
  balance: z.coerce.number().optional(),
  color: z.string().optional(),
});
