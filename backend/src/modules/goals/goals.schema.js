import { z } from 'zod';

export const createGoalSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  years: z.coerce.number().int().positive('Prazo em anos é obrigatório'),
  monthlyRatePct: z.coerce.number().min(0, 'Taxa mensal inválida'),
  targetFinalValue: z.coerce.number().positive('Valor final deve ser positivo'),
  startDate: z.coerce.date().optional(),
});

export const updateInstallmentSchema = z.object({
  status: z.enum(['Pendente', 'Ok'], { error: 'Status deve ser "Pendente" ou "Ok"' }),
});
