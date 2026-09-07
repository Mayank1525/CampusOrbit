import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/register', authLimiter, validate(ctrl.registerSchema), ctrl.register);
router.post('/login', authLimiter, validate(ctrl.loginSchema), ctrl.login);

router.post('/logout', ctrl.logout);
router.get('/me', protect, ctrl.me);

export default router;
