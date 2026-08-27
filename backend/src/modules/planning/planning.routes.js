import { Router } from 'express';
import { validate } from '../../shared/middleware/validate.js';
import { createPlanningItemSchema, updatePlanningItemSchema } from './planning.schema.js';
import * as controller from './planning.controller.js';

const router = Router();

console.log('PLANNING ROUTES LOADED');

router.get('/', controller.list);
router.post('/', validate(createPlanningItemSchema), controller.create);
router.put('/:id', validate(updatePlanningItemSchema), controller.update);
router.delete('/:id', controller.remove);

export default router;
