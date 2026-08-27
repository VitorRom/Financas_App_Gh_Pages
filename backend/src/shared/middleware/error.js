import { logger } from '../utils/logger.js';

export function errorMiddleware(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Erro interno';

  if (status >= 500) {
    logger.error({ err, method: req.method, url: req.url }, 'Erro interno');
  }

  return res.status(status).json({ error: message });
}
