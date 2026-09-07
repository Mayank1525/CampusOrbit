import { Router } from 'express';
import * as ctrl from '../controllers/lesson.controller.js';
import { validate } from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', authorize('admin'), ctrl.listAllLessons);
router.post('/', authorize('admin'), validate(ctrl.adminLessonSchema), ctrl.createLesson);
router.patch('/:id', authorize('admin'), ctrl.updateLesson);
router.delete('/:id', authorize('admin'), ctrl.deleteLesson);

router.get('/:id', ctrl.getLesson);
router.post('/:id/progress', validate(ctrl.progressSchema), ctrl.saveProgress);
router.post('/:id/complete', ctrl.completeLesson);

export default router;
