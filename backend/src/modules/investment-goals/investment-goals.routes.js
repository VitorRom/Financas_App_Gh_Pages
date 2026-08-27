import { Router } from 'express';
import * as controller from './investment-goals.controller.js';

const router = Router();

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.get('/:id/projection', controller.getProjection);

export default router;
