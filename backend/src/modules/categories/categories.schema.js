import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.string().min(1, 'Tipo é obrigatório'),
  color: z.string().default('#6366f1'),
  icon: z.string().default('tag'),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});
