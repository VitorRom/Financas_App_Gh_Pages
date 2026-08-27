import { Router } from 'express';
import { listPlanningItems, createPlanningItem, deletePlanningItem } from '../controllers/planning.js';

export default (prisma) => {
  const router = Router();
  router.get('/', listPlanningItems(prisma));
  router.post('/', createPlanningItem(prisma));
  router.delete('/:id', deletePlanningItem(prisma));
  return router;
};

