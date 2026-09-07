import { Router } from 'express';
import * as ctrl from '../controllers/revision.controller.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', ctrl.listRevisions);
router.post('/', validate(ctrl.createRevisionSchema), ctrl.createRevision);
router.post('/:id/complete', ctrl.completeRevision);
router.post('/:id/reschedule', ctrl.rescheduleRevision);
router.post('/:id/skip', ctrl.skipRevision);

export default router;
