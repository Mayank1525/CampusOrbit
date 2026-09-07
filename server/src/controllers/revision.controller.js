import { z } from 'zod';
import { RevisionTask } from '../models/index.js';
import { REVISION_INTERVALS } from '../models/RevisionTask.js';
import { ok, created, ApiError, asyncHandler } from '../utils/apiResponse.js';

export const createRevisionSchema = z.object({
  topic: z.string().min(2),
  lessonId: z.string().optional().nullable(),
  noteId: z.string().optional().nullable(),
  daysFromNow: z.coerce.number().min(0).max(365).optional().default(1),
});

export const listRevisions = asyncHandler(async (req, res) => {
  const { status = 'pending' } = req.query;
  const q = { userId: req.user._id };
  if (status !== 'all') q.status = status;

  const tasks = await RevisionTask.find(q)
    .populate('lessonId', 'title slug')
    .sort({ dueDate: 1 })
    .lean();

  const now = new Date();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  return ok(res, {
    tasks,
    grouped: {
      overdue: tasks.filter((t) => t.status === 'pending' && new Date(t.dueDate) < now),
      today: tasks.filter(
        (t) =>
          t.status === 'pending' &&
          new Date(t.dueDate) >= now &&
          new Date(t.dueDate) <= endOfToday
      ),
      upcoming: tasks.filter((t) => t.status === 'pending' && new Date(t.dueDate) > endOfToday),
    },
  });
});

export const createRevision = asyncHandler(async (req, res) => {
  const { topic, lessonId, noteId, daysFromNow } = req.body;
  const due = new Date();
  due.setDate(due.getDate() + daysFromNow);
  const task = await RevisionTask.create({
    userId: req.user._id,
    topic,
    lessonId: lessonId || null,
    noteId: noteId || null,
    stage: 1,
    dueDate: due,
  });
  return created(res, { task }, 'Revision scheduled');
});

/**
 * Complete a revision and auto-schedule the next spaced interval.
 * Stage 1 -> +7 days, Stage 2 -> +21 days, Stage 3 -> done.
 */
export const completeRevision = asyncHandler(async (req, res) => {
  const task = await RevisionTask.findOne({ _id: req.params.id, userId: req.user._id });
  if (!task) throw ApiError.notFound('Revision task not found');

  task.status = 'completed';
  task.completedAt = new Date();
  await task.save();

  let nextTask = null;
  if (task.stage < REVISION_INTERVALS.length) {
    const nextStage = task.stage + 1;
    const due = new Date();
    due.setDate(due.getDate() + REVISION_INTERVALS[nextStage - 1]);
    nextTask = await RevisionTask.create({
      userId: req.user._id,
      lessonId: task.lessonId,
      noteId: task.noteId,
      topic: task.topic,
      stage: nextStage,
      dueDate: due,
    });
  }

  return ok(
    res,
    { task, nextTask },
    nextTask
      ? `Revision done. Next review in ${REVISION_INTERVALS[nextTask.stage - 1]} days.`
      : 'Revision cycle complete for this topic 🎉'
  );
});

export const rescheduleRevision = asyncHandler(async (req, res) => {
  const { days = 1 } = req.body;
  const task = await RevisionTask.findOne({ _id: req.params.id, userId: req.user._id });
  if (!task) throw ApiError.notFound('Revision task not found');

  const due = new Date();
  due.setDate(due.getDate() + Number(days));
  task.dueDate = due;
  task.rescheduledCount += 1;
  task.status = 'pending';
  await task.save();

  return ok(res, { task }, `Rescheduled for ${due.toDateString()}`);
});

export const skipRevision = asyncHandler(async (req, res) => {
  const task = await RevisionTask.findOne({ _id: req.params.id, userId: req.user._id });
  if (!task) throw ApiError.notFound('Revision task not found');
  task.status = 'skipped';
  await task.save();
  return ok(res, { task }, 'Revision skipped');
});
