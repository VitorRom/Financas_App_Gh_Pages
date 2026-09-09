import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Lista separada por vírgula de origens permitidas pelo CORS. Vazio = aceita qualquer uma (dev).
  CORS_ORIGIN: z.string().optional(),
  BRAPI_TOKEN: z.string().optional(),
  // Limites de plano (maxTransactions / maxAccounts). Desligado por padrão —
  // ver src/shared/utils/planLimits.js.
  ENFORCE_PLAN_LIMITS: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:');
  parsed.error.issues.forEach((e) => console.error(` - ${e.path.join('.')}: ${e.message}`));
  process.exit(1);
}

export const env = parsed.data;
