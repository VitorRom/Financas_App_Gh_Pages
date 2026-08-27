import 'dotenv/config';
import { env } from './shared/config/env.js';
import { logger } from './shared/utils/logger.js';
import app from './app.js';
import prisma from './shared/lib/prisma.js';


async function start() {
  try {
    if (!process.env.BRAPI_TOKEN) {
      logger.warn('BRAPI_TOKEN não definido — cotações de mercado retornarão 401.');
    }
    await prisma.$connect();
    logger.info('Banco de dados conectado');

    app.listen(env.PORT, () => {
      logger.info(`Servidor rodando na porta ${env.PORT}`);
    });
  } catch (error) {
    logger.error(error, 'Falha ao iniciar servidor');
    process.exit(1);
  }
}

start();
