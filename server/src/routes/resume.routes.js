import { Router } from 'express';
import * as ctrl from '../controllers/resume.controller.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', ctrl.listResumes);
router.post('/', validate(ctrl.resumeSchema), ctrl.createResume);
router.get('/:id', ctrl.getResume);
router.patch('/:id', validate(ctrl.resumeSchema), ctrl.updateResume);
router.post('/:id/duplicate', ctrl.duplicateResume);
router.post('/:id/default', ctrl.setDefaultResume);
router.delete('/:id', ctrl.deleteResume);

export default router;
