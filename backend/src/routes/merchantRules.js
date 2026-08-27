import { Router } from 'express';
import { applyRuleFromTransaction } from '../controllers/merchantRules.js';

export default (prisma) => {
  const router = Router();
  router.post('/from-transaction/:id', applyRuleFromTransaction(prisma));
  return router;
};

