import { Router } from 'express';
import { validate } from '../../shared/middleware/validate.js';
import { createCategorySchema, updateCategorySchema } from './categories.schema.js';
import * as controller from './categories.controller.js';

const router = Router();

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', validate(createCategorySchema), controller.create);
router.put('/:id', validate(updateCategorySchema), controller.update);
router.delete('/:id', controller.remove);

export default router;
