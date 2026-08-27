import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import prisma from './lib/prisma.js';

import transactionRoutes from './routes/transactions.js';
import categoryRoutes from './routes/categories.js';
import accountRoutes from './routes/accounts.js';
import dashboardRoutes from './routes/dashboard.js';
import importRoutes from './routes/imports.js';
import importBatchRoutes from './routes/importBatches.js';
import merchantRuleRoutes from './routes/merchantRules.js';
import maintenanceRoutes from './routes/maintenance.js';
import goalsRoutes from './routes/goals.js';
import planningRoutes from './routes/planning.js';
import investmentRoutes from './routes/investments.js';
import investmentTransactionRoutes from './routes/investmentTransactions.js';
import investmentGoalRoutes from './routes/investmentGoals.js';
import marketRoutes from './routes/market.js';
import authRoutes from './routes/auth.js';
import subscriptionRoutes from './routes/subscriptions.js';
import { authMiddleware } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check (público)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rotas públicas
app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// Rotas protegidas
app.use(authMiddleware);
app.use('/api/transactions', transactionRoutes(prisma));
app.use('/api/categories', categoryRoutes(prisma));
app.use('/api/accounts', accountRoutes(prisma));
app.use('/api/dashboard', dashboardRoutes(prisma));
app.use('/api/import', importRoutes(prisma));
app.use('/api/import', importBatchRoutes(prisma));
app.use('/api/rules', merchantRuleRoutes(prisma));
app.use('/api/maintenance', maintenanceRoutes(prisma));
app.use('/api/goals', goalsRoutes(prisma));
app.use('/api/planning', planningRoutes(prisma));
app.use('/api/investments', investmentRoutes(prisma));
app.use('/api/investment-transactions', investmentTransactionRoutes(prisma));
app.use('/api/investment-goals', investmentGoalRoutes(prisma));
app.use('/api/market', marketRoutes(prisma));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
