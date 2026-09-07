import { Router } from 'express';
import * as ctrl from '../controllers/path.controller.js';
import * as admin from '../controllers/admin.controller.js';
import { validate } from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', ctrl.listPaths);
router.post('/recommend', validate(ctrl.recommendSchema), ctrl.recommendPath);
router.get('/my-progress', ctrl.myProgress);
router.get('/milestone/:id', ctrl.getMilestone);
router.post('/milestone/:milestoneId/complete', ctrl.completeMilestone);
router.post('/switch', ctrl.switchPath);
router.post('/:pathId/start', ctrl.startPath);

// Admin path & milestone CRUD
router.post('/', authorize('admin'), validate(admin.pathSchema), admin.createPath);
router.patch('/:id', authorize('admin'), admin.updatePath);
router.delete('/:id', authorize('admin'), admin.deletePath);
router.post('/milestones', authorize('admin'), validate(admin.milestoneSchema), admin.createMilestone);
router.patch('/milestones/:id', authorize('admin'), admin.updateMilestone);
router.delete('/milestones/:id', authorize('admin'), admin.deleteMilestone);

// Keep the wildcard LAST so it never swallows the routes above.
router.get('/:idOrSlug', ctrl.getPath);

export default router;
