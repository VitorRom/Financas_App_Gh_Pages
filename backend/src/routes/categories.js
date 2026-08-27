import { Router } from 'express';
import {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categories.js';

export default (prisma) => {
  const router = Router();

  router.get('/', getCategories(prisma));
  router.get('/:id', getCategory(prisma));
  router.post('/', createCategory(prisma));
  router.put('/:id', updateCategory(prisma));
  router.delete('/:id', deleteCategory(prisma));

  return router;
};