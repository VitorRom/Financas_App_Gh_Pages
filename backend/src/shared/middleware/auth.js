import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/jwt.js';
import prisma from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('Token não fornecido', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.userId };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Token expirado', 401));
    }
    return next(new AppError('Token inválido', 401));
  }
}

export function requirePlan(feature) {
  return async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { subscription: { include: { plan: true } } },
      });

      if (!user?.subscription) {
        return next(new AppError('Assinatura necessária', 403));
      }

      const features = JSON.parse(user.subscription.plan.features || '{}');

      if (!features[feature]) {
        return next(new AppError('Feature não disponível no seu plano', 403));
      }

      req.plan = user.subscription.plan;
      next();
    } catch (error) {
      next(error);
    }
  };
}
