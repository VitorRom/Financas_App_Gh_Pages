import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { defaultLimiter } from './shared/middleware/rateLimit.js';
import { errorMiddleware } from './shared/middleware/error.js';
import { authMiddleware } from './shared/middleware/auth.js';

import authRoutes from './modules/auth/auth.routes.js';
import accountRoutes from './modules/accounts/accounts.routes.js';
import categoryRoutes from './modules/categories/categories.routes.js';
import transactionRoutes from './modules/transactions/transactions.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import goalRoutes from './modules/goals/goals.routes.js';
import planningRoutes from './modules/planning/planning.routes.js';
import importRoutes from './modules/imports/imports.routes.js';
import subscriptionRoutes from './modules/subscriptions/subscriptions.routes.js';
import maintenanceRoutes from './modules/maintenance/maintenance.routes.js';
import investmentRoutes from './modules/investments/investments.routes.js';
import investmentGoalRoutes from './modules/investment-goals/investment-goals.routes.js';
import marketRoutes from './modules/market/market.routes.js';
import { applyRuleFromTransaction } from './modules/imports/imports.controller.js';

const app = express();

// Segurança e parsing
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(defaultLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rotas públicas
app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// Rotas protegidas
app.use(authMiddleware);
app.use('/api/accounts', accountRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/planning', planningRoutes);
app.use('/api/import', importRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/investment-goals', investmentGoalRoutes);
app.use('/api/market', marketRoutes);
app.post('/api/rules/from-transaction/:id', applyRuleFromTransaction);

// Erro global
app.use(errorMiddleware);

export default app;
