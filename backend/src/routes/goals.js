import { Router } from 'express';
import { listGoals, createGoal, deleteGoal, updateGoalInstallment } from '../controllers/goals.js';

export default (prisma) => {
  const router = Router();
  router.get('/', listGoals(prisma));
  router.post('/', createGoal(prisma));
  router.patch('/installments/:id', updateGoalInstallment(prisma));
  router.delete('/:id', deleteGoal(prisma));
  return router;
};

