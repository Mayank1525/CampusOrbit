import { Router } from 'express';
import * as ctrl from '../controllers/note.controller.js';
import { validate } from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.use(protect);

router.get('/ai-status', ctrl.getAIStatus);
router.get('/mine', ctrl.myNotes);
router.post('/personal', validate(ctrl.personalNoteSchema), ctrl.createPersonalNote);

// Admin AI generation + review
router.post('/generate/:lessonId', authorize('admin'), aiLimiter, ctrl.generateForLesson);
router.get('/review', authorize('admin'), ctrl.listNotesForReview);
router.patch('/:id/publish', authorize('admin'), ctrl.publishNote);

router.patch('/:id', ctrl.updateNote);
router.delete('/:id', ctrl.deleteNote);
router.post('/:id/bookmark', ctrl.toggleBookmark);
router.post('/:id/revision', ctrl.markForRevision);
router.post('/:id/simplify', aiLimiter, ctrl.simplify);
router.post('/:id/highlight', ctrl.addHighlight);

export default router;
