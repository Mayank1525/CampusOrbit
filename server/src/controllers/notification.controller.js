import { Notification, Announcement, User } from '../models/index.js';
import { ok, created, ApiError, asyncHandler } from '../utils/apiResponse.js';
import { notify } from '../services/notification.service.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const { unreadOnly } = req.query;
  const q = { userId: req.user._id };
  if (unreadOnly === 'true') q.read = false;

  const notifications = await Notification.find(q).sort({ createdAt: -1 }).limit(100).lean();
  const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });

  return ok(res, { notifications, unreadCount });
});

export const markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { read: true },
    { new: true }
  );
  if (!n) throw ApiError.notFound('Notification not found');
  return ok(res, { notification: n }, 'Marked as read');
});

export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
  return ok(res, null, 'All notifications marked as read');
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!n) throw ApiError.notFound('Notification not found');
  return ok(res, { id: req.params.id }, 'Notification removed');
});

/** ---- Announcements ---- */

export const listAnnouncements = asyncHandler(async (req, res) => {
  const q = { isPublished: true };
  if (req.user.role === 'student') q.audience = { $in: ['all', 'students'] };
  if (req.user.role === 'senior') q.audience = { $in: ['all', 'seniors'] };

  const announcements = await Announcement.find(q).sort({ pinned: -1, createdAt: -1 }).limit(50).lean();
  return ok(res, { announcements });
});

export const createAnnouncement = asyncHandler(async (req, res) => {
  const { title, body, category = 'general', audience = 'all', pinned = false } = req.body;
  if (!title || !body) throw ApiError.badRequest('Title and body are required');

  const announcement = await Announcement.create({
    title,
    body,
    category,
    audience,
    pinned,
    publishedBy: req.user._id,
    publishedByName: req.user.fullName,
  });

  // Fan out as notifications.
  const roleFilter =
    audience === 'students' ? { role: 'student' } : audience === 'seniors' ? { role: 'senior' } : { role: { $ne: 'admin' } };
  const users = await User.find({ ...roleFilter, isActive: true }).select('_id');

  for (const u of users) {
    // eslint-disable-next-line no-await-in-loop
    await notify({
      userId: u._id,
      type: 'announcement',
      title: `📢 ${title}`,
      body: body.slice(0, 200),
      link: '/notifications',
      icon: 'megaphone',
      priority: category === 'urgent' ? 'high' : 'normal',
      dedupeKey: `ann-${announcement._id}`,
    });
  }

  return created(res, { announcement, notified: users.length }, `Announcement published to ${users.length} users`);
});

export const updateAnnouncement = asyncHandler(async (req, res) => {
  const a = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!a) throw ApiError.notFound('Announcement not found');
  return ok(res, { announcement: a }, 'Announcement updated');
});

export const deleteAnnouncement = asyncHandler(async (req, res) => {
  const a = await Announcement.findByIdAndDelete(req.params.id);
  if (!a) throw ApiError.notFound('Announcement not found');
  return ok(res, { id: req.params.id }, 'Announcement deleted');
});
