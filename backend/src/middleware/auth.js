import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/jwt.js';
import prisma from '../lib/prisma.js';

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.userId };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

export function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.userId };
    next();
  } catch (error) {
    req.user = null;
    next();
  }
}

export function requirePlan(feature) {
  return async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          subscription: {
            include: { plan: true },
          },
        },
      });

      if (!user || !user.subscription) {
        return res.status(403).json({ error: 'Assinatura necessária' });
      }

      const features = JSON.parse(user.subscription.plan.features || '{}');

      if (!features[feature]) {
        return res.status(403).json({ error: 'Feature não disponível no seu plano' });
      }

      req.plan = user.subscription.plan;
      next();
    } catch (error) {
      console.error('Error checking plan:', error);
      return res.status(500).json({ error: 'Erro ao verificar plano' });
    }
  };
}
