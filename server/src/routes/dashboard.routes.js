import { Router } from 'express';
import * as ctrl from '../controllers/dashboard.controller.js';
import * as admin from '../controllers/admin.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/student', ctrl.studentDashboard);
router.get('/charts', ctrl.progressCharts);
router.get('/admin/analytics', authorize('admin'), admin.analytics);
router.get('/admin/student/:id', authorize('admin'), admin.studentDetail);

export default router;
