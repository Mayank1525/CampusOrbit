import { Router } from 'express';
import * as ctrl from '../controllers/user.controller.js';
import { validate } from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.patch('/profile', validate(ctrl.profileSchema), ctrl.updateProfile);
router.get('/stats', ctrl.getProfileStats);
router.get('/public/:id', ctrl.getPublicProfile);

// Admin
router.get('/', authorize('admin'), ctrl.listStudents);
router.patch('/:id/toggle-active', authorize('admin'), ctrl.toggleStudentActive);

export default router;
