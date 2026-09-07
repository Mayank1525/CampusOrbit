import { z } from 'zod';
import MeetSession from '../models/MeetSession.js';
import PeerRoom from '../models/PeerRoom.js';
import { ok, created, ApiError, asyncHandler } from '../utils/apiResponse.js';
import { parseMeetLink } from '../utils/meetLink.js';
import { notify } from '../services/notification.service.js';

/* ─────────────────────────────── schemas ─────────────────────────────── */

export const createMeetSchema = z.object({
  title: z.string().min(4, 'Give the session a clear title').max(140),
  description: z.string().max(2000).optional().default(''),
  topic: z.string().max(80).optional().default(''),
  sessionType: z
    .enum(['mock-interview', 'doubt-clearing', 'guest-talk', 'resume-review', 'group-study', 'other'])
    .optional()
    .default('other'),
  meetLink: z.string().min(4, 'Paste a Google Meet link'),
  scheduledAt: z.string().min(4, 'Pick a date and time'),
  durationMinutes: z.coerce.number().int().min(5).max(480).optional().default(60),
  maxSeats: z.coerce.number().int().min(0).max(1000).optional().default(0),
});

export const updateMeetSchema = createMeetSchema.partial();

export const rsvpSchema = z.object({
  status: z.enum(['going', 'maybe', 'not-going']),
});

export const recapSchema = z.object({
  recapNotes: z.string().max(4000).optional().default(''),
  recordingLink: z.string().max(500).optional().default(''),
});

/* ─────────────────────────────── helpers ─────────────────────────────── */

/** Only alumni/seniors and the placement cell may host. */
function assertCanHost(user) {
  if (!['senior', 'admin'].includes(user.role)) {
    throw ApiError.forbidden(
      'Only alumni/seniors and the placement cell can host a Google Meet session'
    );
  }
}

function assertCanManage(session, user) {
  const isHost = String(session.hostId?._id || session.hostId) === String(user._id);
  if (!isHost && user.role !== 'admin') {
    throw ApiError.forbidden('Only the host or an admin can manage this session');
  }
}

/**
 * Shape a session for the client.
 * The Meet link is withheld until the user has RSVP'd *and* the session is
 * within its join window — an unlisted link pasted into a public room would
 * otherwise leak to anyone who can read the page.
 */
function present(session, user) {
  const obj = session.toObject({ virtuals: true });
  const uid = String(user._id);

  const mine = (obj.rsvps || []).find((r) => String(r.userId?._id || r.userId) === uid);
  const isHost = String(obj.hostId?._id || obj.hostId) === uid;
  const state = obj.computedStatus;

  obj.myRsvp = mine ? mine.status : null;
  obj.isHost = isHost;
  obj.state = state;

  const joinable = state === 'live';
  const allowed = isHost || user.role === 'admin' || (mine && mine.status !== 'not-going');

  obj.canJoinNow = joinable && allowed;
  if (!allowed) {
    obj.meetLink = null;
    obj.linkHiddenReason = 'RSVP to reveal the meeting link';
  } else if (!joinable) {
    obj.meetLink = null;
    obj.linkHiddenReason =
      state === 'scheduled' ? 'Link opens 10 minutes before start' : 'This session has finished';
  }

  // Never ship the full attendee list to non-hosts.
  if (!isHost && user.role !== 'admin') {
    obj.rsvps = undefined;
  }

  return obj;
}

/* ─────────────────────────────── endpoints ────────────────────────────── */

/** All sessions for a room (upcoming first, then past). */
export const listRoomSessions = asyncHandler(async (req, res) => {
  const room = await PeerRoom.findById(req.params.id);
  if (!room) throw ApiError.notFound('Room not found');

  const sessions = await MeetSession.find({ roomId: room._id })
    .populate('hostId', 'fullName role avatarColor avatarUrl')
    .populate('rsvps.userId', 'fullName avatarColor avatarUrl')
    .sort({ scheduledAt: -1 })
    .limit(50);

  return ok(res, { sessions: sessions.map((s) => present(s, req.user)) }, 'Room sessions');
});

/** Everything the current student can attend, across all rooms. */
export const listUpcoming = asyncHandler(async (req, res) => {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const sessions = await MeetSession.find({
    scheduledAt: { $gte: cutoff },
    status: { $ne: 'cancelled' },
  })
    .populate('hostId', 'fullName role avatarColor avatarUrl')
    .populate('roomId', 'name slug accentColor')
    .sort({ scheduledAt: 1 })
    .limit(20);

  return ok(res, { sessions: sessions.map((s) => present(s, req.user)) }, 'Upcoming sessions');
});

/**
 * Powers the dedicated "Live Sessions" section: every session across every
 * room, with filters and headline counts. Deliberately separate from
 * listUpcoming (which is the compact cross-room strip on the rooms page).
 */
export const browseSessions = asyncHandler(async (req, res) => {
  const { scope = 'upcoming', type = 'all', hosted, q = '' } = req.query;

  const query = {};
  if (type !== 'all') query.sessionType = type;
  if (hosted === 'me') query.hostId = req.user._id;

  const now = new Date();
  if (scope === 'past') {
    query.scheduledAt = { $lt: new Date(now.getTime() - 2 * 60 * 60 * 1000) };
  } else if (scope === 'upcoming') {
    query.scheduledAt = { $gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) };
    query.status = { $ne: 'cancelled' };
  }

  if (q.trim()) {
    const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ title: rx }, { topic: rx }, { description: rx }];
  }

  const sessions = await MeetSession.find(query)
    .populate('hostId', 'fullName role avatarColor avatarUrl')
    .populate('roomId', 'name slug accentColor')
    .sort(scope === 'past' ? { scheduledAt: -1 } : { scheduledAt: 1 })
    .limit(60);

  // Headline counts are always computed over everything, not the filtered set,
  // so the numbers do not jump around as the user changes filters.
  const all = await MeetSession.find({ status: { $ne: 'cancelled' } })
    .select('scheduledAt durationMinutes status rsvps hostId')
    .lean();

  let live = 0;
  let upcoming = 0;
  let myRsvps = 0;
  const uid = String(req.user._id);
  for (const s of all) {
    const start = new Date(s.scheduledAt).getTime();
    const end = start + (s.durationMinutes || 60) * 60000;
    const t = now.getTime();
    if (s.status === 'ended') continue;
    if ((s.status === 'live' || t >= start - 10 * 60000) && t <= end) live += 1;
    else if (t < start) upcoming += 1;
    if ((s.rsvps || []).some((r) => String(r.userId) === uid && r.status !== 'not-going')) myRsvps += 1;
  }

  return ok(
    res,
    {
      sessions: sessions.map((x) => present(x, req.user)),
      stats: { live, upcoming, myRsvps, total: all.length },
      canHost: ['senior', 'admin'].includes(req.user.role),
    },
    'Sessions'
  );
});

export const getSession = asyncHandler(async (req, res) => {
  const session = await MeetSession.findById(req.params.sessionId)
    .populate('hostId', 'fullName role avatarColor avatarUrl')
    .populate('roomId', 'name slug accentColor')
    .populate('rsvps.userId', 'fullName avatarColor avatarUrl');
  if (!session) throw ApiError.notFound('Session not found');
  return ok(res, { session: present(session, req.user) }, 'Session');
});

export const createSession = asyncHandler(async (req, res) => {
  assertCanHost(req.user);

  const room = await PeerRoom.findById(req.params.id);
  if (!room) throw ApiError.notFound('Room not found');

  const parsed = parseMeetLink(req.body.meetLink);
  if (!parsed.valid) throw ApiError.badRequest(parsed.reason);

  const when = new Date(req.body.scheduledAt);
  if (Number.isNaN(when.getTime())) throw ApiError.badRequest('Invalid date and time');
  if (when.getTime() < Date.now() - 60_000) {
    throw ApiError.badRequest('Pick a time in the future');
  }

  const session = await MeetSession.create({
    roomId: room._id,
    hostId: req.user._id,
    title: req.body.title,
    description: req.body.description || '',
    topic: req.body.topic || room.topic || '',
    sessionType: req.body.sessionType || 'other',
    meetLink: parsed.url,
    scheduledAt: when,
    durationMinutes: req.body.durationMinutes || 60,
    maxSeats: req.body.maxSeats || 0,
    // Host is automatically going.
    rsvps: [{ userId: req.user._id, status: 'going' }],
  });

  room.lastActivityAt = new Date();
  await room.save({ validateBeforeSave: false });

  // Tell every room member.
  const memberIds = (room.members || []).filter((m) => String(m) !== String(req.user._id));
  await Promise.all(
    memberIds.map((uid) =>
      notify({
        userId: uid,
        type: 'room-reply',
        title: `New live session: ${session.title}`,
        body: `${req.user.fullName} is hosting in ${room.name} on ${when.toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}.`,
        link: `/rooms/${room.slug}`,
        icon: 'video',
        priority: 'high',
        dedupeKey: `meet-new-${session._id}-${uid}`,
      })
    )
  );

  const full = await MeetSession.findById(session._id)
    .populate('hostId', 'fullName role avatarColor avatarUrl')
    .populate('rsvps.userId', 'fullName avatarColor avatarUrl');

  const io = req.app.get('io');
  if (io) {
    io.to(`room:${room._id}`).emit('meet-session-created', { session: present(full, req.user) });
  }

  return created(res, { session: present(full, req.user) }, 'Session scheduled');
});

export const updateSession = asyncHandler(async (req, res) => {
  const session = await MeetSession.findById(req.params.sessionId);
  if (!session) throw ApiError.notFound('Session not found');
  assertCanManage(session, req.user);

  const patch = {};
  for (const k of ['title', 'description', 'topic', 'sessionType', 'durationMinutes', 'maxSeats']) {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  }

  if (req.body.meetLink !== undefined) {
    const parsed = parseMeetLink(req.body.meetLink);
    if (!parsed.valid) throw ApiError.badRequest(parsed.reason);
    patch.meetLink = parsed.url;
  }

  if (req.body.scheduledAt !== undefined) {
    const when = new Date(req.body.scheduledAt);
    if (Number.isNaN(when.getTime())) throw ApiError.badRequest('Invalid date and time');
    patch.scheduledAt = when;
  }

  Object.assign(session, patch);
  await session.save();

  const full = await MeetSession.findById(session._id)
    .populate('hostId', 'fullName role avatarColor avatarUrl')
    .populate('rsvps.userId', 'fullName avatarColor avatarUrl');

  const io = req.app.get('io');
  if (io) io.to(`room:${session.roomId}`).emit('meet-session-updated', { sessionId: String(session._id) });

  return ok(res, { session: present(full, req.user) }, 'Session updated');
});

export const cancelSession = asyncHandler(async (req, res) => {
  const session = await MeetSession.findById(req.params.sessionId);
  if (!session) throw ApiError.notFound('Session not found');
  assertCanManage(session, req.user);

  session.status = 'cancelled';
  await session.save({ validateBeforeSave: false });

  const going = (session.rsvps || []).filter((r) => r.status !== 'not-going');
  await Promise.all(
    going.map((r) =>
      notify({
        userId: r.userId,
        type: 'room-reply',
        title: `Cancelled: ${session.title}`,
        body: 'The host cancelled this live session.',
        link: `/rooms`,
        icon: 'video',
        priority: 'high',
        dedupeKey: `meet-cancel-${session._id}-${r.userId}`,
      })
    )
  );

  const io = req.app.get('io');
  if (io) io.to(`room:${session.roomId}`).emit('meet-session-updated', { sessionId: String(session._id) });

  return ok(res, { sessionId: String(session._id) }, 'Session cancelled');
});

/** Student RSVP. Enforces seat limits atomically enough for this scale. */
export const rsvp = asyncHandler(async (req, res) => {
  const session = await MeetSession.findById(req.params.sessionId);
  if (!session) throw ApiError.notFound('Session not found');
  if (session.status === 'cancelled') throw ApiError.badRequest('This session was cancelled');

  const uid = String(req.user._id);
  const wanted = req.body.status;
  const existing = (session.rsvps || []).find((r) => String(r.userId) === uid);

  if (wanted === 'going' && session.maxSeats > 0) {
    const goingNow = (session.rsvps || []).filter(
      (r) => r.status === 'going' && String(r.userId) !== uid
    ).length;
    if (goingNow >= session.maxSeats) {
      throw ApiError.badRequest('This session is full');
    }
  }

  if (existing) {
    existing.status = wanted;
    existing.respondedAt = new Date();
  } else {
    session.rsvps.push({ userId: req.user._id, status: wanted, respondedAt: new Date() });
  }
  await session.save({ validateBeforeSave: false });

  // Make sure the student is a room member so the session shows in their list.
  if (wanted === 'going') {
    await PeerRoom.updateOne({ _id: session.roomId }, { $addToSet: { members: req.user._id } });
  }

  const full = await MeetSession.findById(session._id)
    .populate('hostId', 'fullName role avatarColor avatarUrl')
    .populate('rsvps.userId', 'fullName avatarColor avatarUrl');

  const io = req.app.get('io');
  if (io) {
    io.to(`room:${session.roomId}`).emit('meet-rsvp-updated', {
      sessionId: String(session._id),
      goingCount: full.goingCount,
    });
  }

  return ok(res, { session: present(full, req.user) }, 'RSVP saved');
});

/** Records attendance and returns the real link. */
export const joinSession = asyncHandler(async (req, res) => {
  const session = await MeetSession.findById(req.params.sessionId);
  if (!session) throw ApiError.notFound('Session not found');
  if (session.status === 'cancelled') throw ApiError.badRequest('This session was cancelled');

  const uid = String(req.user._id);
  const isHost = String(session.hostId) === uid;
  const state = session.computedStatus;

  if (!isHost && req.user.role !== 'admin' && state !== 'live') {
    throw ApiError.badRequest(
      state === 'scheduled'
        ? 'The link opens 10 minutes before the session starts'
        : 'This session has already finished'
    );
  }

  let entry = (session.rsvps || []).find((r) => String(r.userId) === uid);
  if (!entry) {
    session.rsvps.push({ userId: req.user._id, status: 'going', attended: true, joinedAt: new Date() });
    entry = session.rsvps[session.rsvps.length - 1];
  } else {
    entry.attended = true;
    entry.joinedAt = entry.joinedAt || new Date();
    if (entry.status === 'not-going') entry.status = 'going';
  }

  if (isHost && session.status === 'scheduled') {
    session.status = 'live';
    session.startedAt = session.startedAt || new Date();
  }

  await session.save({ validateBeforeSave: false });

  const io = req.app.get('io');
  if (io) {
    io.to(`room:${session.roomId}`).emit('meet-attendance', {
      sessionId: String(session._id),
      userId: uid,
      fullName: req.user.fullName,
    });
  }

  return ok(res, { meetLink: session.meetLink, sessionId: String(session._id) }, 'Joining session');
});

/** Host explicitly starts / ends. */
export const setLiveState = asyncHandler(async (req, res) => {
  const session = await MeetSession.findById(req.params.sessionId);
  if (!session) throw ApiError.notFound('Session not found');
  assertCanManage(session, req.user);

  const action = req.params.action;
  if (action === 'start') {
    session.status = 'live';
    session.startedAt = session.startedAt || new Date();
  } else if (action === 'end') {
    session.status = 'ended';
    session.endedAt = new Date();
  } else {
    throw ApiError.badRequest('Unknown action');
  }
  await session.save({ validateBeforeSave: false });

  const io = req.app.get('io');
  if (io) {
    io.to(`room:${session.roomId}`).emit('meet-session-updated', {
      sessionId: String(session._id),
      status: session.status,
    });
  }

  return ok(res, { status: session.status }, action === 'start' ? 'Session is live' : 'Session ended');
});

/** Host adds notes / recording after the fact. */
export const addRecap = asyncHandler(async (req, res) => {
  const session = await MeetSession.findById(req.params.sessionId);
  if (!session) throw ApiError.notFound('Session not found');
  assertCanManage(session, req.user);

  if (req.body.recapNotes !== undefined) session.recapNotes = req.body.recapNotes;
  if (req.body.recordingLink !== undefined) session.recordingLink = req.body.recordingLink;
  await session.save({ validateBeforeSave: false });

  const attendees = (session.rsvps || []).filter((r) => r.attended);
  await Promise.all(
    attendees.map((r) =>
      notify({
        userId: r.userId,
        type: 'new-resource',
        title: `Recap posted: ${session.title}`,
        body: 'The host shared notes from the session you attended.',
        link: `/rooms`,
        icon: 'file-text',
        dedupeKey: `meet-recap-${session._id}-${r.userId}`,
      })
    )
  );

  return ok(res, { session: { _id: session._id, recapNotes: session.recapNotes } }, 'Recap saved');
});

/** Host/admin attendance report. */
export const attendance = asyncHandler(async (req, res) => {
  const session = await MeetSession.findById(req.params.sessionId).populate(
    'rsvps.userId',
    'fullName email profile.branch profile.graduationYear avatarColor'
  );
  if (!session) throw ApiError.notFound('Session not found');
  assertCanManage(session, req.user);

  const rows = (session.rsvps || []).map((r) => ({
    userId: r.userId?._id,
    fullName: r.userId?.fullName || 'Unknown',
    email: r.userId?.email || '',
    branch: r.userId?.profile?.branch || '',
    graduationYear: r.userId?.profile?.graduationYear || '',
    status: r.status,
    attended: r.attended,
    joinedAt: r.joinedAt,
  }));

  return ok(
    res,
    {
      title: session.title,
      scheduledAt: session.scheduledAt,
      totals: {
        invited: rows.length,
        going: rows.filter((r) => r.status === 'going').length,
        attended: rows.filter((r) => r.attended).length,
      },
      rows,
    },
    'Attendance'
  );
});
