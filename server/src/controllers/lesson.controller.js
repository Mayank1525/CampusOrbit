import { z } from 'zod';
import mongoose from 'mongoose';
import {
  Lesson,
  Milestone,
  StudentProgress,
  Note,
  Flashcard,
  Quiz,
  RevisionTask,
} from '../models/index.js';
import { ok, created, ApiError, asyncHandler } from '../utils/apiResponse.js';
import { notify } from '../services/notification.service.js';
import { getOrCreateProgress } from '../services/progress.service.js';

export const progressSchema = z.object({
  watchedSeconds: z.coerce.number().min(0).optional(),
  lastTimestamp: z.coerce.number().min(0).optional(),
  percent: z.coerce.number().min(0).max(100).optional(),
  practiceDone: z.boolean().optional(),
});

export const getLesson = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = mongoose.isValidObjectId(id) ? { _id: id } : { slug: id };
  const lesson = await Lesson.findOne(query).lean();
  if (!lesson) throw ApiError.notFound('Lesson not found');

  const [milestone, notes, flashcards, quiz, siblings] = await Promise.all([
    Milestone.findById(lesson.milestoneId).lean(),
    Note.find({ lessonId: lesson._id, kind: 'ai', status: 'published' }).lean(),
    Flashcard.find({ lessonId: lesson._id, userId: null }).lean(),
    Quiz.findOne({ lessonId: lesson._id, isPublished: true }).lean(),
    Lesson.find({ pathId: lesson.pathId }).sort({ order: 1 }).select('title slug order milestoneId').lean(),
  ]);

  const index = siblings.findIndex((l) => String(l._id) === String(lesson._id));
  const previous = index > 0 ? siblings[index - 1] : null;
  const next = index < siblings.length - 1 ? siblings[index + 1] : null;

  let myProgress = null;
  let personalNotes = [];
  if (req.user) {
    const progress = await StudentProgress.findOne({
      userId: req.user._id,
      pathId: lesson.pathId,
    }).lean();
    if (progress) {
      myProgress = (progress.lessons || []).find((l) => String(l.lessonId) === String(lesson._id)) || null;
    }
    personalNotes = await Note.find({ lessonId: lesson._id, userId: req.user._id, kind: 'personal' }).lean();
  }

  // Strip correct answers from the quiz payload sent to students.
  const safeQuiz = quiz
    ? {
        ...quiz,
        questions: quiz.questions.map((q) => ({
          _id: q._id,
          question: q.question,
          options: q.options,
          topic: q.topic,
        })),
      }
    : null;

  return ok(res, {
    lesson,
    milestone,
    notes,
    personalNotes,
    flashcards,
    quiz: safeQuiz,
    navigation: { previous, next, index: index + 1, total: siblings.length },
    myProgress,
  });
});

/** Save approximate playback progress (resume-from-timestamp). */
export const saveProgress = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) throw ApiError.notFound('Lesson not found');

  // Atomic: two rapid progress pings must not both try to insert.
  const progress = await getOrCreateProgress(req.user._id, lesson.pathId);

  let entry = progress.lessons.find((l) => String(l.lessonId) === String(lesson._id));
  if (!entry) {
    entry = { lessonId: lesson._id, milestoneId: lesson.milestoneId };
    progress.lessons.push(entry);
    entry = progress.lessons[progress.lessons.length - 1];
  }

  const { watchedSeconds, lastTimestamp, percent, practiceDone } = req.body;
  if (watchedSeconds !== undefined) entry.watchedSeconds = Math.max(entry.watchedSeconds || 0, watchedSeconds);
  if (lastTimestamp !== undefined) entry.lastTimestamp = lastTimestamp;
  if (percent !== undefined) entry.percent = Math.max(entry.percent || 0, Math.round(percent));
  if (practiceDone !== undefined) entry.practiceDone = practiceDone;
  entry.updatedAt = new Date();

  progress.lastAccessedLessonId = lesson._id;

  // Mark milestone in-progress
  const ms = progress.milestones.find((m) => String(m.milestoneId) === String(lesson.milestoneId));
  if (ms && ms.status === 'current') ms.status = 'in-progress';

  await progress.save();
  return ok(res, { lessonProgress: entry }, 'Progress saved');
});

/**
 * Mark a lesson complete.
 * Enforces the quiz requirement when the lesson demands it.
 */
export const completeLesson = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) throw ApiError.notFound('Lesson not found');

  const progress = await StudentProgress.findOne({ userId: req.user._id, pathId: lesson.pathId });
  if (!progress) throw ApiError.badRequest('Start this path first');

  let entry = progress.lessons.find((l) => String(l.lessonId) === String(lesson._id));
  if (!entry) {
    progress.lessons.push({ lessonId: lesson._id, milestoneId: lesson.milestoneId });
    entry = progress.lessons[progress.lessons.length - 1];
  }

  if (lesson.requiresQuizToComplete && !entry.quizPassed) {
    throw ApiError.badRequest(
      'Pass the lesson quiz before marking this lesson complete. This keeps your preparation score honest.'
    );
  }

  entry.completed = true;
  entry.completedAt = new Date();
  entry.percent = 100;

  // Auto-complete the milestone when all its lessons are done.
  const milestoneLessons = await Lesson.find({ milestoneId: lesson.milestoneId }).select('_id');
  const doneIds = progress.lessons.filter((l) => l.completed).map((l) => String(l.lessonId));
  const allDone = milestoneLessons.every((l) => doneIds.includes(String(l._id)));

  let milestoneCompleted = false;
  if (allDone) {
    const ms = progress.milestones.find((m) => String(m.milestoneId) === String(lesson.milestoneId));
    if (ms && ms.status !== 'completed') {
      ms.status = 'completed';
      ms.completedAt = new Date();
      milestoneCompleted = true;

      const milestone = await Milestone.findById(lesson.milestoneId);
      (milestone?.topicTags || []).forEach((t) => {
        const key = t.toLowerCase();
        if (!progress.completedTopics.includes(key)) progress.completedTopics.push(key);
      });

      const all = await Milestone.find({ pathId: lesson.pathId }).sort({ order: 1 });
      const next = all.find((m) => m.order > (milestone?.order ?? 0));
      if (next) {
        const ne = progress.milestones.find((m) => String(m.milestoneId) === String(next._id));
        if (ne && ne.status === 'locked') ne.status = 'current';
        else if (!ne) progress.milestones.push({ milestoneId: next._id, status: 'current' });
      }
    }
  }

  await progress.save();

  // Schedule spaced revision (1 day) if not already scheduled.
  const existingRevision = await RevisionTask.findOne({
    userId: req.user._id,
    lessonId: lesson._id,
    status: 'pending',
  });
  if (!existingRevision) {
    const due = new Date();
    due.setDate(due.getDate() + 1);
    await RevisionTask.create({
      userId: req.user._id,
      lessonId: lesson._id,
      topic: lesson.title,
      stage: 1,
      dueDate: due,
    });
  }

  if (milestoneCompleted) {
    await notify({
      userId: req.user._id,
      type: 'new-resource',
      title: 'Milestone complete 🎉',
      body: `You finished a milestone on your path. The next node in your Learning Orbit is now unlocked.`,
      link: '/my-path',
      icon: 'trophy',
      priority: 'high',
    });
  }

  return ok(res, { lessonProgress: entry, milestoneCompleted }, 'Lesson completed');
});

/** ---- Admin lesson CRUD ---- */

export const adminLessonSchema = z.object({
  milestoneId: z.string().min(1),
  title: z.string().min(3),
  summary: z.string().optional(),
  topic: z.string().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  estimatedMinutes: z.coerce.number().min(1).max(600).optional(),
  order: z.coerce.number().optional(),
  practiceTask: z.string().optional(),
  requiresQuizToComplete: z.boolean().optional(),
  authorizedTranscript: z.string().optional(),
  transcriptSource: z.enum(['admin-authored', 'creator-permitted', 'none']).optional(),
  primaryVideo: z.object({
    youtubeVideoId: z.string().min(5),
    title: z.string().min(2),
    channelName: z.string().optional(),
    duration: z.coerce.number().optional(),
    thumbnail: z.string().optional(),
    reasonForRecommendation: z.string().optional(),
    verifiedBy: z.string().optional(),
    isEmbeddable: z.boolean().optional(),
  }),
});

export const createLesson = asyncHandler(async (req, res) => {
  const milestone = await Milestone.findById(req.body.milestoneId);
  if (!milestone) throw ApiError.notFound('Milestone not found');

  const count = await Lesson.countDocuments({ milestoneId: milestone._id });
  const slugBase = req.body.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const lesson = await Lesson.create({
    ...req.body,
    pathId: milestone.pathId,
    slug: `${slugBase}-${Date.now().toString(36)}`,
    order: req.body.order ?? count + 1,
    createdBy: req.user._id,
    primaryVideo: {
      ...req.body.primaryVideo,
      thumbnail:
        req.body.primaryVideo.thumbnail ||
        `https://i.ytimg.com/vi/${req.body.primaryVideo.youtubeVideoId}/hqdefault.jpg`,
    },
  });

  return created(res, { lesson }, 'Lesson created with its single primary video');
});

export const updateLesson = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) throw ApiError.notFound('Lesson not found');

  const fields = [
    'title',
    'summary',
    'topic',
    'difficulty',
    'estimatedMinutes',
    'order',
    'practiceTask',
    'requiresQuizToComplete',
    'authorizedTranscript',
    'transcriptSource',
    'isPublished',
    'keyTakeaways',
  ];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) lesson[f] = req.body[f];
  });

  if (req.body.primaryVideo) {
    lesson.primaryVideo = { ...lesson.primaryVideo.toObject(), ...req.body.primaryVideo };
    if (!lesson.primaryVideo.thumbnail && lesson.primaryVideo.youtubeVideoId) {
      lesson.primaryVideo.thumbnail = `https://i.ytimg.com/vi/${lesson.primaryVideo.youtubeVideoId}/hqdefault.jpg`;
    }
  }

  await lesson.save();
  return ok(res, { lesson }, 'Lesson updated');
});

export const deleteLesson = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findByIdAndDelete(req.params.id);
  if (!lesson) throw ApiError.notFound('Lesson not found');
  await Promise.all([
    Note.deleteMany({ lessonId: lesson._id }),
    Flashcard.deleteMany({ lessonId: lesson._id }),
    Quiz.deleteMany({ lessonId: lesson._id }),
  ]);
  return ok(res, { id: lesson._id }, 'Lesson deleted');
});

export const listAllLessons = asyncHandler(async (req, res) => {
  const { pathId } = req.query;
  const q = pathId ? { pathId } : {};
  const lessons = await Lesson.find(q)
    .populate('pathId', 'title slug')
    .populate('milestoneId', 'title order')
    .sort({ createdAt: -1 })
    .lean();
  return ok(res, { lessons });
});
