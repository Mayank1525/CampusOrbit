import { Router } from 'express';
import * as ctrl from '../controllers/quiz.controller.js';
import { validate } from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/attempts/mine', ctrl.myAttempts);
router.post('/', authorize('admin'), ctrl.upsertQuiz);
router.delete('/:id', authorize('admin'), ctrl.deleteQuiz);
router.get('/:id', ctrl.getQuiz);
router.post('/:id/submit', validate(ctrl.submitSchema), ctrl.submitQuiz);

export default router;
