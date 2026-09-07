import { Router } from 'express';
import * as ctrl from '../controllers/interview.controller.js';
import { validate } from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.use(protect);

router.get('/questions', ctrl.getQuestions);
router.post('/answer', aiLimiter, validate(ctrl.answerSchema), ctrl.submitAnswer);
router.get('/attempts', ctrl.myAttempts);
router.get('/attempts/:id', ctrl.getAttempt);

// Admin question bank
router.get('/admin/questions', authorize('admin'), ctrl.listAllQuestions);
router.post('/admin/questions', authorize('admin'), ctrl.createQuestion);
router.patch('/admin/questions/:id', authorize('admin'), ctrl.updateQuestion);
router.delete('/admin/questions/:id', authorize('admin'), ctrl.deleteQuestion);

export default router;
