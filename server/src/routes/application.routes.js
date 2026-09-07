import { Router } from 'express';
import * as ctrl from '../controllers/application.controller.js';
import { validate } from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/mine', ctrl.myApplications);
router.post('/', validate(ctrl.applySchema), ctrl.applyToOpportunity);

// Placement cell
router.get('/applicants', authorize('admin'), ctrl.listApplicants);
router.get('/export', authorize('admin'), ctrl.exportApplicantsCSV);
router.patch('/:id/stage', authorize('admin'), validate(ctrl.stageSchema), ctrl.updateApplicantStage);
router.patch('/:id/admin-note', authorize('admin'), ctrl.addAdminNote);

router.patch('/:id/my-stage', validate(ctrl.stageSchema), ctrl.updateMyStage);
router.delete('/:id', ctrl.withdrawApplication);
router.get('/:id', ctrl.getApplication);

export default router;
