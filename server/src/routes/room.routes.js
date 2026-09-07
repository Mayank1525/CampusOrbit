import { Router } from 'express';
import * as ctrl from '../controllers/room.controller.js';
import * as meet from '../controllers/meet.controller.js';
import { validate } from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.use(protect);

router.get('/', ctrl.listRooms);
router.post('/', authorize('admin'), ctrl.createRoom);

// Moderation
router.get('/moderation/reported', authorize('admin'), ctrl.reportedMessages);
router.post('/moderation/:messageId', authorize('admin'), ctrl.moderateMessage);

router.patch('/:id', authorize('admin'), ctrl.updateRoom);
router.delete('/:id', authorize('admin'), ctrl.deleteRoom);

router.post('/:id/join', ctrl.joinRoom);
router.post('/:id/leave', ctrl.leaveRoom);
router.get('/:id/messages', ctrl.getMessages);
router.post('/:id/messages', validate(ctrl.messageSchema), ctrl.postMessage);
router.post('/:id/resources', ctrl.addResourceLink);
router.get('/:id/summary', aiLimiter, ctrl.roomSummary);

// Watch Together
router.post('/:id/watch', ctrl.startWatchSession);
router.get('/watch/:sessionId', ctrl.getWatchSession);
router.post('/watch/:sessionId/end', ctrl.endWatchSession);
router.post('/watch/:sessionId/study-point', ctrl.addStudyPoint);

// ---- Google Meet live sessions ----
// Static paths first so they are not captured by /:idOrSlug.
router.get('/meet/upcoming', meet.listUpcoming);
// Must be registered before '/meet/:sessionId' or 'browse' is read as an id.
router.get('/meet/browse', meet.browseSessions);
router.get('/meet/:sessionId', meet.getSession);
router.patch('/meet/:sessionId', validate(meet.updateMeetSchema), meet.updateSession);
router.delete('/meet/:sessionId', meet.cancelSession);
router.post('/meet/:sessionId/rsvp', validate(meet.rsvpSchema), meet.rsvp);
router.post('/meet/:sessionId/join', meet.joinSession);
router.post('/meet/:sessionId/start', (req, res, next) => {
  req.params.action = 'start';
  return meet.setLiveState(req, res, next);
});
router.post('/meet/:sessionId/end', (req, res, next) => {
  req.params.action = 'end';
  return meet.setLiveState(req, res, next);
});
router.post('/meet/:sessionId/recap', validate(meet.recapSchema), meet.addRecap);
router.get('/meet/:sessionId/attendance', meet.attendance);

router.get('/:id/meet', meet.listRoomSessions);
router.post('/:id/meet', validate(meet.createMeetSchema), meet.createSession);

// Message actions
router.post('/messages/:messageId/react', ctrl.reactToMessage);
router.post('/messages/:messageId/pin', ctrl.pinMessage);
router.post('/messages/:messageId/report', ctrl.reportMessage);

router.get('/:idOrSlug', ctrl.getRoom);

export default router;
