import Notification from '../models/Notification.js';

/** Create a notification, avoiding duplicates via dedupeKey. */
export async function notify({
  userId,
  type = 'system',
  title,
  body = '',
  link = '',
  icon = 'bell',
  priority = 'normal',
  meta = {},
  dedupeKey = '',
}) {
  if (dedupeKey) {
    const existing = await Notification.findOne({ userId, dedupeKey });
    if (existing) return existing;
  }
  return Notification.create({ userId, type, title, body, link, icon, priority, meta, dedupeKey });
}

export async function notifyMany(userIds, payload) {
  const results = [];
  for (const userId of userIds) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await notify({ ...payload, userId }));
  }
  return results;
}
