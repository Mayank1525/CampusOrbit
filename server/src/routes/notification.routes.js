import { Router } from 'express';
import * as ctrl from '../controllers/notification.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', ctrl.listNotifications);
router.post('/read-all', ctrl.markAllRead);
router.post('/:id/read', ctrl.markRead);
router.delete('/:id', ctrl.deleteNotification);

// Announcements
router.get('/announcements/list', ctrl.listAnnouncements);
router.post('/announcements', authorize('admin'), ctrl.createAnnouncement);
router.patch('/announcements/:id', authorize('admin'), ctrl.updateAnnouncement);
router.delete('/announcements/:id', authorize('admin'), ctrl.deleteAnnouncement);

export default router;
