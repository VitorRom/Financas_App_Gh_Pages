import { Router } from 'express';
import { listGoals, createGoal, updateGoal, deleteGoal, getProjection } from '../controllers/investmentGoals.js';

export default (prisma) => {
  const router = Router();

  router.get('/', listGoals(prisma));
  router.post('/', createGoal(prisma));
  router.put('/:id', updateGoal(prisma));
  router.delete('/:id', deleteGoal(prisma));
  router.get('/:id/projection', getProjection(prisma));

  return router;
};
