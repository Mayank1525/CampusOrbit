import { Server } from 'socket.io';
import cookie from 'cookie';
import { env } from '../config/env.js';
import { authenticateSocket, COOKIE_NAME } from '../middleware/auth.js';
import { PeerRoom, Message, WatchSession } from '../models/index.js';
import { notify } from './notification.service.js';

/**
 * Socket.IO: group chat + Watch Together synchronisation.
 * NO WebRTC, no audio/video capture — shared YouTube playback state only.
 */
export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => cb(null, true),
      credentials: true,
    },
    path: '/socket.io',
  });

  // Track online members per room: roomId -> Map(userId -> {name, role, sockets:Set})
  const presence = new Map();

  const roomKey = (roomId) => `room:${roomId}`;

  function addPresence(roomId, user, socketId) {
    if (!presence.has(roomId)) presence.set(roomId, new Map());
    const members = presence.get(roomId);
    const entry = members.get(String(user._id)) || {
      userId: String(user._id),
      name: user.fullName,
      role: user.role,
      avatarColor: user.avatarColor,
      sockets: new Set(),
    };
    entry.sockets.add(socketId);
    members.set(String(user._id), entry);
    return members;
  }

  function removePresence(roomId, userId, socketId) {
    const members = presence.get(roomId);
    if (!members) return null;
    const entry = members.get(String(userId));
    if (entry) {
      entry.sockets.delete(socketId);
      if (!entry.sockets.size) members.delete(String(userId));
    }
    return members;
  }

  function onlineList(roomId) {
    const members = presence.get(roomId);
    if (!members) return [];
    return [...members.values()].map(({ userId, name, role, avatarColor }) => ({
      userId,
      name,
      role,
      avatarColor,
    }));
  }

  function emitPresence(roomId) {
    io.to(roomKey(roomId)).emit('presence-update', {
      roomId,
      online: onlineList(roomId),
      count: onlineList(roomId).length,
    });
  }

  // ---- Auth handshake ----
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token;
      if (!token && socket.handshake.headers?.cookie) {
        const parsed = cookie.parse(socket.handshake.headers.cookie);
        token = parsed[COOKIE_NAME];
      }
      const user = await authenticateSocket(token);
      if (!user) return next(new Error('Unauthorized socket connection'));
      socket.user = user;
      return next();
    } catch (err) {
      return next(new Error('Socket authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    socket.joinedRooms = new Set();

    socket.emit('connected', { userId: user._id, name: user.fullName });

    // ---- Group chat ----
    socket.on('join-room', async ({ roomId }, ack) => {
      try {
        const room = await PeerRoom.findById(roomId);
        if (!room) return ack?.({ error: 'Room not found' });

        socket.join(roomKey(roomId));
        socket.joinedRooms.add(String(roomId));
        addPresence(String(roomId), user, socket.id);

        // Persist membership
        if (!room.members.some((m) => String(m) === String(user._id))) {
          room.members.push(user._id);
          await room.save();
        }

        emitPresence(String(roomId));
        socket.to(roomKey(roomId)).emit('member-joined', {
          userId: String(user._id),
          name: user.fullName,
          role: user.role,
        });

        // Send current watch session state so late joiners sync immediately.
        const session = room.activeWatchSessionId
          ? await WatchSession.findById(room.activeWatchSessionId)
          : null;
        ack?.({
          ok: true,
          online: onlineList(String(roomId)),
          watchSession: session
            ? { ...session.toObject(), currentPosition: session.currentPosition() }
            : null,
        });
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    socket.on('leave-room', ({ roomId }, ack) => {
      socket.leave(roomKey(roomId));
      socket.joinedRooms.delete(String(roomId));
      removePresence(String(roomId), user._id, socket.id);
      emitPresence(String(roomId));
      ack?.({ ok: true });
    });

    socket.on('send-message', async (payload, ack) => {
      try {
        const { roomId, text, replyTo = null, type = 'text', videoTimestamp = null } = payload || {};
        if (!roomId || !text || !text.trim()) return ack?.({ error: 'Message cannot be empty' });
        if (text.length > 2000) return ack?.({ error: 'Message is too long' });

        const room = await PeerRoom.findById(roomId);
        if (!room) return ack?.({ error: 'Room not found' });

        const message = await Message.create({
          roomId,
          userId: user._id,
          authorName: user.fullName,
          authorRole: user.role,
          text: text.trim(),
          type,
          replyTo: replyTo || null,
          videoTimestamp,
          watchSessionId: room.activeWatchSessionId || null,
        });

        room.lastActivityAt = new Date();
        await room.save();

        const populated = await Message.findById(message._id)
          .populate('userId', 'fullName role avatarColor')
          .populate({ path: 'replyTo', select: 'text authorName' })
          .lean();

        io.to(roomKey(roomId)).emit('new-message', populated);

        // Notify the author of the replied-to message.
        if (replyTo) {
          const parent = await Message.findById(replyTo);
          if (parent && String(parent.userId) !== String(user._id)) {
            await notify({
              userId: parent.userId,
              type: 'room-reply',
              title: `${user.fullName} replied to you`,
              body: text.slice(0, 140),
              link: `/peer-rooms/${roomId}`,
              icon: 'message-circle',
            });
          }
        }

        ack?.({ ok: true, message: populated });
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    socket.on('typing', ({ roomId, isTyping }) => {
      socket.to(roomKey(roomId)).emit('user-typing', {
        userId: String(user._id),
        name: user.fullName,
        isTyping,
      });
    });

    socket.on('react-message', async ({ messageId, emoji = '👍' }, ack) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return ack?.({ error: 'Message not found' });

        const existing = message.reactions.find(
          (r) => String(r.userId) === String(user._id) && r.emoji === emoji
        );
        if (existing) {
          message.reactions = message.reactions.filter(
            (r) => !(String(r.userId) === String(user._id) && r.emoji === emoji)
          );
        } else {
          message.reactions.push({ emoji, userId: user._id });
        }
        await message.save();

        io.to(roomKey(String(message.roomId))).emit('message-reaction', {
          messageId: String(message._id),
          reactions: message.reactions,
        });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    // ---- Watch Together ----

    const canControl = async (session) => {
      if (!session) return false;
      if (String(session.hostId) === String(user._id)) return true;
      if (user.role === 'admin') return true;
      const room = await PeerRoom.findById(session.roomId);
      return room?.moderators?.some((m) => String(m) === String(user._id)) || false;
    };

    socket.on('join-watch-session', async ({ sessionId }, ack) => {
      try {
        const session = await WatchSession.findById(sessionId);
        if (!session || !session.isActive) return ack?.({ error: 'No active watch session' });

        socket.join(`watch:${sessionId}`);
        if (!session.participants.some((p) => String(p) === String(user._id))) {
          session.participants.push(user._id);
          await session.save();
        }

        const state = {
          sessionId: String(session._id),
          youtubeVideoId: session.youtubeVideoId,
          title: session.title,
          state: session.state,
          positionSeconds: session.currentPosition(),
          serverTime: Date.now(),
          hostId: String(session.hostId),
          hostName: session.hostName,
          studyPoints: session.pinnedStudyPoints,
        };

        io.to(`watch:${sessionId}`).emit('watch-participant-joined', {
          userId: String(user._id),
          name: user.fullName,
        });

        ack?.({ ok: true, state });
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    socket.on('leave-watch-session', ({ sessionId }, ack) => {
      socket.leave(`watch:${sessionId}`);
      socket.to(`watch:${sessionId}`).emit('watch-participant-left', {
        userId: String(user._id),
        name: user.fullName,
      });
      ack?.({ ok: true });
    });

    /** Host broadcasts authoritative state. */
    socket.on('sync-video-state', async ({ sessionId, state, positionSeconds }, ack) => {
      try {
        const session = await WatchSession.findById(sessionId);
        if (!session) return ack?.({ error: 'Session not found' });
        if (!(await canControl(session))) return ack?.({ error: 'Only the host can control playback' });

        session.state = state === 'playing' ? 'playing' : 'paused';
        session.positionSeconds = Number(positionSeconds) || 0;
        session.lastSyncAt = new Date();
        await session.save();

        io.to(`watch:${sessionId}`).emit('video-state-changed', {
          sessionId,
          state: session.state,
          positionSeconds: session.positionSeconds,
          serverTime: Date.now(),
          by: user.fullName,
        });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    socket.on('video-play', async ({ sessionId, positionSeconds }, ack) => {
      try {
        const session = await WatchSession.findById(sessionId);
        if (!session) return ack?.({ error: 'Session not found' });
        if (!(await canControl(session))) return ack?.({ error: 'Only the host can control playback' });

        session.state = 'playing';
        session.positionSeconds = Number(positionSeconds) || session.positionSeconds;
        session.lastSyncAt = new Date();
        await session.save();

        io.to(`watch:${sessionId}`).emit('video-play', {
          sessionId,
          positionSeconds: session.positionSeconds,
          serverTime: Date.now(),
          by: user.fullName,
        });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    socket.on('video-pause', async ({ sessionId, positionSeconds }, ack) => {
      try {
        const session = await WatchSession.findById(sessionId);
        if (!session) return ack?.({ error: 'Session not found' });
        if (!(await canControl(session))) return ack?.({ error: 'Only the host can control playback' });

        session.state = 'paused';
        session.positionSeconds = Number(positionSeconds) || session.positionSeconds;
        session.lastSyncAt = new Date();
        await session.save();

        io.to(`watch:${sessionId}`).emit('video-pause', {
          sessionId,
          positionSeconds: session.positionSeconds,
          serverTime: Date.now(),
          by: user.fullName,
        });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    socket.on('video-seek', async ({ sessionId, positionSeconds }, ack) => {
      try {
        const session = await WatchSession.findById(sessionId);
        if (!session) return ack?.({ error: 'Session not found' });
        if (!(await canControl(session))) return ack?.({ error: 'Only the host can control playback' });

        session.positionSeconds = Number(positionSeconds) || 0;
        session.lastSyncAt = new Date();
        await session.save();

        io.to(`watch:${sessionId}`).emit('video-seek', {
          sessionId,
          positionSeconds: session.positionSeconds,
          state: session.state,
          serverTime: Date.now(),
          by: user.fullName,
        });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    /** Any participant can pull the authoritative state. */
    socket.on('request-resync', async ({ sessionId }, ack) => {
      try {
        const session = await WatchSession.findById(sessionId);
        if (!session) return ack?.({ error: 'Session not found' });

        const state = {
          sessionId: String(session._id),
          youtubeVideoId: session.youtubeVideoId,
          state: session.state,
          positionSeconds: session.currentPosition(),
          serverTime: Date.now(),
        };
        socket.emit('video-resync', state);
        ack?.({ ok: true, state });
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    /** Timestamped chat message tied to the shared video. */
    socket.on('send-timestamp-message', async ({ roomId, sessionId, text, timestamp }, ack) => {
      try {
        if (!text?.trim()) return ack?.({ error: 'Message cannot be empty' });

        const message = await Message.create({
          roomId,
          userId: user._id,
          authorName: user.fullName,
          authorRole: user.role,
          text: text.trim(),
          type: 'timestamp',
          videoTimestamp: Number(timestamp) || 0,
          watchSessionId: sessionId || null,
        });

        const populated = await Message.findById(message._id)
          .populate('userId', 'fullName role avatarColor')
          .lean();

        io.to(roomKey(roomId)).emit('new-message', populated);
        ack?.({ ok: true, message: populated });
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    socket.on('disconnect', () => {
      socket.joinedRooms.forEach((roomId) => {
        removePresence(roomId, user._id, socket.id);
        emitPresence(roomId);
      });
    });
  });

  return io;
}
