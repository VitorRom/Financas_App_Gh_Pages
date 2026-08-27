import { logger } from '../utils/logger.js';

export function errorMiddleware(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    logger.error({ err, method: req.method, url: req.url }, 'Erro interno');
    // Em produção, nunca retornar a mensagem original de erros 500
    // (pode vazar queries, paths, nomes de tabela, etc.).
    const safeMessage = process.env.NODE_ENV === 'production'
      ? 'Erro interno do servidor'
      : err.message || 'Erro interno';
    return res.status(status).json({ error: safeMessage });
  }

  // Erros < 500 são AppError ou similares com mensagens seguras para o cliente.
  const message = err.message || 'Erro';
  return res.status(status).json({ error: message });
}
