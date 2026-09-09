import { z } from 'zod';

const emptyToUndefined = (v) => (v === '' || v == null ? undefined : v);

/**
 * Mês de início do item, absoluto. Aceita "YYYY-MM" (o que o `<input type="month">`
 * envia) ou uma data completa. É normalizado para o primeiro dia do mês em UTC no
 * service, para que o mês não mude conforme o fuso de quem lê.
 *
 * Substituiu `startMonth`, que era um deslocamento em meses relativo a "hoje" — e
 * por isso empurrava o item para o mês seguinte a cada virada de mês.
 */
const startMonthRef = z.preprocess(
  emptyToUndefined,
  z
    .union([
      z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês de início inválido. Use o formato AAAA-MM.'),
      z.coerce.date(),
    ])
    .optional(),
);

const baseFields = {
  name: z.string().min(1, 'Nome é obrigatório'),
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  type: z.enum(['income', 'expense'], { error: 'Tipo deve ser "income" ou "expense"' }),
  dayOfMonth: z.coerce.number().int().min(1).max(31).default(1),
  monthsDuration: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
  startDate: startMonthRef,
};

export const createPlanningItemSchema = z.object(baseFields);
export const updatePlanningItemSchema = z.object(baseFields);
