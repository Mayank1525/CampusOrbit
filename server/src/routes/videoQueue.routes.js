import { Router } from 'express';
import * as ctrl from '../controllers/videoQueue.controller.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', ctrl.listQueue);
router.post('/', validate(ctrl.addSchema), ctrl.addToQueue);
router.post('/validate', ctrl.validateUrl);
router.patch('/:id', ctrl.updateQueueItem);
router.post('/:id/bookmark', ctrl.toggleQueueBookmark);
router.delete('/:id', ctrl.deleteQueueItem);

export default router;
