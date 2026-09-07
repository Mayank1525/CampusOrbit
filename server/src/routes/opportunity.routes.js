import { Router } from 'express';
import * as ctrl from '../controllers/opportunity.controller.js';
import { validate } from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', ctrl.listOpportunities);
router.get('/matches', ctrl.matchedOpportunities);
router.get('/bookmarks', ctrl.listBookmarks);

router.post('/', authorize('admin'), validate(ctrl.opportunitySchema), ctrl.createOpportunity);
router.patch('/:id', authorize('admin'), ctrl.updateOpportunity);
router.post('/:id/publish', authorize('admin'), ctrl.publishOpportunity);
router.post('/:id/expire', authorize('admin'), ctrl.expireOpportunity);
router.delete('/:id', authorize('admin'), ctrl.deleteOpportunity);
router.get('/:id/eligible-students', authorize('admin'), ctrl.eligibleStudents);

router.post('/:id/bookmark', ctrl.toggleBookmarkOpportunity);
router.get('/:id', ctrl.getOpportunity);

export default router;
