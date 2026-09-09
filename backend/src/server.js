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

      // Sem `--watch`, alterações no código só entram com restart manual, e a API
      // segue servindo a versão anterior — o que aparece no frontend como 404 em
      // rota nova ou campo faltando na resposta. O aviso evita esse diagnóstico caro.
      // `npm_lifecycle_event` é o nome do script npm em execução ("dev" ou "start").
      const viaDevScript = process.env.npm_lifecycle_event === 'dev';
      if (env.NODE_ENV !== 'production' && !viaDevScript) {
        logger.warn(
          'Hot reload desligado: o código só recarrega com restart manual. ' +
            'Durante o desenvolvimento use `npm run dev`.',
        );
      }
    });
  } catch (error) {
    logger.error(error, 'Falha ao iniciar servidor');
    process.exit(1);
  }
}

start();
