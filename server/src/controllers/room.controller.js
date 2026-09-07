import { z } from 'zod';
import mongoose from 'mongoose';
import { PeerRoom, Message, WatchSession, User } from '../models/index.js';
import { ok, created, ApiError, asyncHandler } from '../utils/apiResponse.js';
import { summariseRoom, aiStatus } from '../services/ai.service.js';
import { extractYouTubeId, thumbnailFor, fetchOEmbed } from '../utils/youtube.js';

export const messageSchema = z.object({
  text: z.string().min(1, 'Type a message').max(2000),
  replyTo: z.string().optional().nullable(),
  type: z.enum(['text', 'resource', 'timestamp']).optional(),
  videoTimestamp: z.coerce.number().optional().nullable(),
});

export const listRooms = asyncHandler(async (req, res) => {
  const rooms = await PeerRoom.find({ isArchived: false })
    .populate('activeWatchSessionId', 'youtubeVideoId title state isActive')
    .sort({ lastActivityAt: -1 })
    .lean();

  const withCounts = await Promise.all(
    rooms.map(async (r) => ({
      ...r,
      memberCount: (r.members || []).length,
      messageCount: await Message.countDocuments({ roomId: r._id, isHidden: false }),
      isMember: req.user ? (r.members || []).some((m) => String(m) === String(req.user._id)) : false,
    }))
  );

  return ok(res, { rooms: withCounts });
});

export const getRoom = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const query = mongoose.isValidObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug };

  const room = await PeerRoom.findOne(query)
    .populate('members', 'fullName role avatarColor')
    .populate('moderators', 'fullName role avatarColor')
    .populate({ path: 'pinnedMessages', populate: { path: 'userId', select: 'fullName avatarColor' } });
  if (!room) throw ApiError.notFound('Room not found');

  const messages = await Message.find({ roomId: room._id, isHidden: false })
    .populate('userId', 'fullName role avatarColor')
    .populate({ path: 'replyTo', select: 'text authorName' })
    .sort({ createdAt: 1 })
    .limit(200)
    .lean();

  const watchSession = room.activeWatchSessionId
    ? await WatchSession.findById(room.activeWatchSessionId)
    : null;

  const history = await WatchSession.find({ roomId: room._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  return ok(res, {
    room,
    messages,
    watchSession: watchSession
      ? { ...watchSession.toObject(), currentPosition: watchSession.currentPosition() }
      : null,
    watchHistory: history,
    isMember: room.members.some((m) => String(m._id) === String(req.user._id)),
    isModerator:
      room.moderators.some((m) => String(m._id) === String(req.user._id)) || req.user.role === 'admin',
  });
});

export const joinRoom = asyncHandler(async (req, res) => {
  const room = await PeerRoom.findById(req.params.id);
  if (!room) throw ApiError.notFound('Room not found');
  if (!room.isApproved && req.user.role !== 'admin') {
    throw ApiError.forbidden('This room is awaiting approval');
  }

  const already = room.members.some((m) => String(m) === String(req.user._id));
  if (!already) {
    room.members.push(req.user._id);
    room.lastActivityAt = new Date();
    await room.save();
  }
  return ok(res, { joined: true, memberCount: room.members.length }, `Joined ${room.name}`);
});

export const leaveRoom = asyncHandler(async (req, res) => {
  const room = await PeerRoom.findById(req.params.id);
  if (!room) throw ApiError.notFound('Room not found');
  room.members = room.members.filter((m) => String(m) !== String(req.user._id));
  await room.save();
  return ok(res, { left: true, memberCount: room.members.length }, `Left ${room.name}`);
});

/** REST fallback for sending a message (Socket.IO is the primary path). */
export const postMessage = asyncHandler(async (req, res) => {
  const room = await PeerRoom.findById(req.params.id);
  if (!room) throw ApiError.notFound('Room not found');

  const message = await Message.create({
    roomId: room._id,
    userId: req.user._id,
    authorName: req.user.fullName,
    authorRole: req.user.role,
    text: req.body.text,
    type: req.body.type || 'text',
    replyTo: req.body.replyTo || null,
    videoTimestamp: req.body.videoTimestamp ?? null,
    watchSessionId: room.activeWatchSessionId || null,
  });

  room.lastActivityAt = new Date();
  await room.save();

  const populated = await Message.findById(message._id)
    .populate('userId', 'fullName role avatarColor')
    .populate({ path: 'replyTo', select: 'text authorName' })
    .lean();

  const io = req.app.get('io');
  if (io) io.to(`room:${room._id}`).emit('new-message', populated);

  return created(res, { message: populated }, 'Message sent');
});

export const getMessages = asyncHandler(async (req, res) => {
  const messages = await Message.find({ roomId: req.params.id, isHidden: false })
    .populate('userId', 'fullName role avatarColor')
    .populate({ path: 'replyTo', select: 'text authorName' })
    .sort({ createdAt: 1 })
    .limit(300)
    .lean();
  return ok(res, { messages });
});

export const reactToMessage = asyncHandler(async (req, res) => {
  const { emoji = '👍' } = req.body;
  const message = await Message.findById(req.params.messageId);
  if (!message) throw ApiError.notFound('Message not found');

  const existing = message.reactions.find(
    (r) => String(r.userId) === String(req.user._id) && r.emoji === emoji
  );
  if (existing) {
    message.reactions = message.reactions.filter(
      (r) => !(String(r.userId) === String(req.user._id) && r.emoji === emoji)
    );
  } else {
    message.reactions.push({ emoji, userId: req.user._id });
  }
  await message.save();

  const io = req.app.get('io');
  if (io) {
    io.to(`room:${message.roomId}`).emit('message-reaction', {
      messageId: message._id,
      reactions: message.reactions,
    });
  }
  return ok(res, { reactions: message.reactions }, existing ? 'Reaction removed' : 'Reaction added');
});

export const pinMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.messageId);
  if (!message) throw ApiError.notFound('Message not found');

  const room = await PeerRoom.findById(message.roomId);
  const isMod = room.moderators.some((m) => String(m) === String(req.user._id)) || req.user.role === 'admin';
  if (!isMod) throw ApiError.forbidden('Only moderators can pin messages');

  message.isPinned = !message.isPinned;
  await message.save();

  if (message.isPinned) {
    if (!room.pinnedMessages.some((p) => String(p) === String(message._id))) {
      room.pinnedMessages.push(message._id);
    }
  } else {
    room.pinnedMessages = room.pinnedMessages.filter((p) => String(p) !== String(message._id));
  }
  await room.save();

  const io = req.app.get('io');
  if (io) io.to(`room:${room._id}`).emit('message-pinned', { messageId: message._id, isPinned: message.isPinned });

  return ok(res, { message }, message.isPinned ? 'Message pinned' : 'Message unpinned');
});

export const reportMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.messageId);
  if (!message) throw ApiError.notFound('Message not found');
  const already = message.reports.some((r) => String(r.userId) === String(req.user._id));
  if (already) throw ApiError.conflict('You already reported this message');

  message.reports.push({ userId: req.user._id, reason: req.body.reason || 'Inappropriate' });
  await message.save();
  return ok(res, { reported: true }, 'Reported to moderators. Thank you for keeping rooms safe.');
});

export const addResourceLink = asyncHandler(async (req, res) => {
  const { label, url } = req.body;
  if (!label || !url) throw ApiError.badRequest('Label and URL are required');

  const room = await PeerRoom.findById(req.params.id);
  if (!room) throw ApiError.notFound('Room not found');

  room.resourceLinks.push({ label, url, addedBy: req.user._id });
  await room.save();
  return created(res, { resourceLinks: room.resourceLinks }, 'Resource shared with the room');
});

/** AI room summary (honest demo fallback). */
export const roomSummary = asyncHandler(async (req, res) => {
  const room = await PeerRoom.findById(req.params.id);
  if (!room) throw ApiError.notFound('Room not found');

  const messages = await Message.find({ roomId: room._id, isHidden: false })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const summary = summariseRoom(messages.reverse(), room.name);
  return ok(res, { ...summary, aiStatus: aiStatus() });
});

/** ---- Watch Together ---- */

export const startWatchSession = asyncHandler(async (req, res) => {
  const room = await PeerRoom.findById(req.params.id);
  if (!room) throw ApiError.notFound('Room not found');

  const isMod =
    room.moderators.some((m) => String(m) === String(req.user._id)) ||
    ['admin', 'senior'].includes(req.user.role);
  if (!isMod) throw ApiError.forbidden('Only a moderator, admin or senior can start a watch session');

  const videoId = extractYouTubeId(req.body.url || req.body.youtubeVideoId);
  if (!videoId) throw ApiError.badRequest('Provide a valid YouTube URL or video ID');

  // End any previous active session for this room.
  await WatchSession.updateMany(
    { roomId: room._id, isActive: true },
    { $set: { isActive: false, state: 'ended', endedAt: new Date() } }
  );

  const meta = await fetchOEmbed(videoId);

  const session = await WatchSession.create({
    roomId: room._id,
    hostId: req.user._id,
    hostName: req.user.fullName,
    youtubeVideoId: videoId,
    title: req.body.title || meta?.title || 'Study session',
    thumbnail: meta?.thumbnail || thumbnailFor(videoId),
    state: 'paused',
    positionSeconds: 0,
    lastSyncAt: new Date(),
    participants: [req.user._id],
  });

  room.activeWatchSessionId = session._id;
  room.lastActivityAt = new Date();
  await room.save();

  await Message.create({
    roomId: room._id,
    userId: req.user._id,
    authorName: req.user.fullName,
    authorRole: req.user.role,
    text: `started a Watch Together session: ${session.title}`,
    type: 'system',
    watchSessionId: session._id,
  });

  const io = req.app.get('io');
  if (io) {
    io.to(`room:${room._id}`).emit('watch-session-started', {
      session: { ...session.toObject(), currentPosition: 0 },
    });
  }

  return created(res, { session }, 'Watch Together session started');
});

export const endWatchSession = asyncHandler(async (req, res) => {
  const session = await WatchSession.findById(req.params.sessionId);
  if (!session) throw ApiError.notFound('Session not found');

  const room = await PeerRoom.findById(session.roomId);
  const isHost = String(session.hostId) === String(req.user._id);
  const isMod = room.moderators.some((m) => String(m) === String(req.user._id)) || req.user.role === 'admin';
  if (!isHost && !isMod) throw ApiError.forbidden('Only the host or a moderator can end this session');

  session.isActive = false;
  session.state = 'ended';
  session.endedAt = new Date();
  await session.save();

  room.activeWatchSessionId = null;
  await room.save();

  const io = req.app.get('io');
  if (io) io.to(`room:${room._id}`).emit('watch-session-ended', { sessionId: session._id });

  return ok(res, { session }, 'Watch session ended');
});

export const addStudyPoint = asyncHandler(async (req, res) => {
  const { timestamp, label } = req.body;
  const session = await WatchSession.findById(req.params.sessionId);
  if (!session) throw ApiError.notFound('Session not found');

  session.pinnedStudyPoints.push({
    timestamp: Number(timestamp) || 0,
    label: label || 'Study point',
    addedBy: req.user._id,
  });
  await session.save();

  const io = req.app.get('io');
  if (io) {
    io.to(`room:${session.roomId}`).emit('study-point-added', {
      sessionId: session._id,
      studyPoints: session.pinnedStudyPoints,
    });
  }
  return created(res, { studyPoints: session.pinnedStudyPoints }, 'Study point pinned');
});

export const getWatchSession = asyncHandler(async (req, res) => {
  const session = await WatchSession.findById(req.params.sessionId);
  if (!session) throw ApiError.notFound('Session not found');
  return ok(res, { session: { ...session.toObject(), currentPosition: session.currentPosition() } });
});

/** ---- Admin room management ---- */

export const createRoom = asyncHandler(async (req, res) => {
  const { name, description, topic, category = 'general', accentColor } = req.body;
  if (!name) throw ApiError.badRequest('Room name is required');

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const exists = await PeerRoom.findOne({ slug });
  if (exists) throw ApiError.conflict('A room with a similar name already exists');

  const room = await PeerRoom.create({
    name,
    slug,
    description,
    topic,
    category,
    accentColor: accentColor || '#7c5cff',
    moderators: [req.user._id],
    members: [req.user._id],
  });
  return created(res, { room }, 'Room created');
});

export const updateRoom = asyncHandler(async (req, res) => {
  const room = await PeerRoom.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!room) throw ApiError.notFound('Room not found');
  return ok(res, { room }, 'Room updated');
});

export const deleteRoom = asyncHandler(async (req, res) => {
  const room = await PeerRoom.findByIdAndDelete(req.params.id);
  if (!room) throw ApiError.notFound('Room not found');
  await Message.deleteMany({ roomId: room._id });
  return ok(res, { id: req.params.id }, 'Room deleted');
});

/** Moderation: reported messages queue. */
export const reportedMessages = asyncHandler(async (req, res) => {
  const messages = await Message.find({ 'reports.0': { $exists: true } })
    .populate('userId', 'fullName email role')
    .populate('roomId', 'name slug')
    .sort({ updatedAt: -1 })
    .lean();
  return ok(res, { messages });
});

export const moderateMessage = asyncHandler(async (req, res) => {
  const { action } = req.body; // 'hide' | 'restore' | 'delete'
  const message = await Message.findById(req.params.messageId);
  if (!message) throw ApiError.notFound('Message not found');

  if (action === 'delete') {
    await message.deleteOne();
    const io = req.app.get('io');
    if (io) io.to(`room:${message.roomId}`).emit('message-deleted', { messageId: message._id });
    return ok(res, { id: req.params.messageId }, 'Message deleted');
  }

  message.isHidden = action === 'hide';
  await message.save();
  return ok(res, { message }, message.isHidden ? 'Message hidden' : 'Message restored');
});
