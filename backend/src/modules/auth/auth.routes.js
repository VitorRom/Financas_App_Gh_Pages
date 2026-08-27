import { Router } from 'express';
import { authMiddleware } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { authLimiter } from '../../shared/middleware/rateLimit.js';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
} from './auth.schema.js';
import * as controller from './auth.controller.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), controller.register);
router.post('/login', authLimiter, validate(loginSchema), controller.login);

router.get('/me', authMiddleware, controller.getMe);
router.put('/profile', authMiddleware, validate(updateProfileSchema), controller.updateProfile);
router.put('/password', authMiddleware, validate(changePasswordSchema), controller.changePassword);

export default router;
