import { z } from 'zod';
import mongoose from 'mongoose';
import {
  LearningPath,
  Milestone,
  Lesson,
  StudentProgress,
  User,
  Opportunity,
} from '../models/index.js';
import { ok, created, ApiError, asyncHandler } from '../utils/apiResponse.js';
import { getOrCreateProgress } from '../services/progress.service.js';

export const recommendSchema = z.object({
  goal: z.string().min(1, 'Choose a goal'),
  level: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  weeklyHours: z.coerce.number().min(1).max(80).default(10),
  timelineWeeks: z.coerce.number().min(2).max(104).default(12),
});

export const listPaths = asyncHandler(async (req, res) => {
  const paths = await LearningPath.find({ isPublished: true }).sort({ createdAt: 1 }).lean();
  const withCounts = await Promise.all(
    paths.map(async (p) => {
      const [milestoneCount, lessonCount] = await Promise.all([
        Milestone.countDocuments({ pathId: p._id }),
        Lesson.countDocuments({ pathId: p._id }),
      ]);
      return { ...p, milestoneCount, lessonCount };
    })
  );
  return ok(res, { paths: withCounts });
});

/** Full path detail with milestones, lessons and (if logged in) progress. */
export const getPath = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const query = mongoose.isValidObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug };
  const path = await LearningPath.findOne(query).lean();
  if (!path) throw ApiError.notFound('Learning path not found');

  const milestones = await Milestone.find({ pathId: path._id }).sort({ order: 1 }).lean();
  const lessons = await Lesson.find({ pathId: path._id }).sort({ order: 1 }).lean();

  const milestonesWithLessons = milestones.map((m) => ({
    ...m,
    lessons: lessons.filter((l) => String(l.milestoneId) === String(m._id)),
  }));

  let progress = null;
  if (req.user) {
    progress = await StudentProgress.findOne({ userId: req.user._id, pathId: path._id }).lean();
  }

  return ok(res, {
    path,
    milestones: milestonesWithLessons,
    totals: { milestones: milestones.length, lessons: lessons.length },
    progress,
  });
});

/**
 * Recommend exactly ONE primary path with an explanation.
 * Deterministic, explainable scoring - no black box.
 */
export const recommendPath = asyncHandler(async (req, res) => {
  const { goal, level, weeklyHours, timelineWeeks } = req.body;
  const paths = await LearningPath.find({ isPublished: true }).lean();
  if (!paths.length) throw ApiError.notFound('No learning paths available');

  const goalLower = goal.toLowerCase();

  const scored = paths.map((p) => {
    let score = 0;
    const reasons = [];

    const tagHit = (p.goalTags || []).some(
      (t) => goalLower.includes(t.toLowerCase()) || t.toLowerCase().includes(goalLower)
    );
    if (tagHit) {
      score += 50;
      reasons.push(`Your goal "${goal}" directly matches this path.`);
    }
    if (p.title.toLowerCase().includes(goalLower) || goalLower.includes(p.title.toLowerCase())) {
      score += 25;
      reasons.push(`The path title aligns with your stated goal.`);
    }
    if (p.level === level) {
      score += 15;
      reasons.push(`Designed for your current level (${level}).`);
    } else if (
      (level === 'intermediate' && p.level === 'beginner') ||
      (level === 'advanced' && p.level === 'intermediate')
    ) {
      score += 7;
      reasons.push(`Slightly below your level, so you can move fast through early milestones.`);
    }

    const fits = p.recommendedWeeklyHours <= weeklyHours + 4;
    if (fits) {
      score += 10;
      reasons.push(`Fits your ${weeklyHours} hrs/week schedule (needs about ${p.recommendedWeeklyHours} hrs/week).`);
    } else {
      reasons.push(`Needs about ${p.recommendedWeeklyHours} hrs/week — a bit more than your ${weeklyHours} hrs.`);
    }

    if (p.estimatedWeeks <= timelineWeeks) {
      score += 10;
      reasons.push(`Completable in ${p.estimatedWeeks} weeks, inside your ${timelineWeeks}-week target.`);
    } else {
      reasons.push(`Typically takes ${p.estimatedWeeks} weeks — longer than your ${timelineWeeks}-week target, so we will prioritise the highest-impact milestones first.`);
    }

    return { path: p, score, reasons };
  });

  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];

  // Pace plan
  const totalLessons = await Lesson.countDocuments({ pathId: winner.path._id });
  const weeks = Math.max(1, Math.min(timelineWeeks, winner.path.estimatedWeeks));
  const lessonsPerWeek = Math.ceil(totalLessons / weeks);

  return ok(res, {
    recommended: winner.path,
    score: winner.score,
    reasons: winner.reasons,
    plan: {
      weeks,
      weeklyHours,
      lessonsPerWeek,
      note: `Follow ONE path. Complete about ${lessonsPerWeek} lesson(s) per week for ${weeks} weeks. Ignore every other sheet until this is done.`,
    },
    alternatives: scored.slice(1, 4).map((s) => ({
      path: s.path,
      score: s.score,
      whyNotPrimary: `Scored ${s.score} vs ${winner.score}. ${s.reasons[0] || 'Less aligned with your goal.'}`,
    })),
  });
});

/** Start (or resume) a path. Transfers matching completed topics from other paths. */
export const startPath = asyncHandler(async (req, res) => {
  const { pathId } = req.params;
  const { weeklyHours = 10, timelineWeeks = 12, transferProgress = true } = req.body || {};

  const path = await LearningPath.findById(pathId);
  if (!path) throw ApiError.notFound('Learning path not found');

  const milestones = await Milestone.find({ pathId: path._id }).sort({ order: 1 });

  // Collect completed topics from the student's other paths for transfer.
  let completedTopics = [];
  if (transferProgress) {
    const others = await StudentProgress.find({ userId: req.user._id });
    completedTopics = [...new Set(others.flatMap((o) => o.completedTopics || []))];
  }

  const transferredTitles = [];
  const milestoneStates = milestones.map((m, idx) => {
    const topicMatch =
      completedTopics.length &&
      (m.topicTags || []).length &&
      m.topicTags.every((t) => completedTopics.includes(t.toLowerCase()));

    if (topicMatch) {
      transferredTitles.push(m.title);
      return { milestoneId: m._id, status: 'completed', completedAt: new Date() };
    }
    return { milestoneId: m._id, status: idx === 0 ? 'current' : 'locked' };
  });

  // Ensure exactly one "current" milestone after transfers.
  const firstOpen = milestoneStates.find((m) => m.status !== 'completed');
  if (firstOpen) firstOpen.status = 'current';

  // Atomic upsert. Starting a path you are already on is idempotent, and two
  // concurrent clicks converge on one document instead of raising E11000.
  const existingBefore = await StudentProgress.findOne({ userId: req.user._id, pathId: path._id })
    .select('_id')
    .lean();

  const progress = await getOrCreateProgress(req.user._id, path._id, {
    weeklyHours,
    targetTimelineWeeks: timelineWeeks,
    milestones: milestoneStates,
    completedTopics,
    recommendationReason: req.body.reason || 'Selected from Path Navigator',
  });

  const isNew = !existingBefore;
  const transferred = isNew ? transferredTitles : [];

  if (!isNew) {
    // Re-starting / resuming an existing path: refresh the plan, keep the work.
    progress.status = 'active';
    progress.weeklyHours = weeklyHours;
    progress.targetTimelineWeeks = timelineWeeks;
    await progress.save();
  }

  // Starting a path IS the finish line of onboarding, so both facts are written
  // in one atomic update. Previously the client did this in two calls
  // (start path, then PATCH onboardingCompleted). If the second call never
  // landed -- closed tab, network blip, a toast the user dismissed -- the
  // account was left with an activePathId but onboardingCompleted=false, and
  // ProtectedRoute bounced every route back to /onboarding forever. The user
  // could not escape and every retry said they were already on the path.
  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { activePathId: path._id, onboardingCompleted: true },
    { new: true }
  );

  return created(
    res,
    { progress, transferredMilestones: transferred, user: updatedUser },
    transferred.length
      ? `Path started. ${transferred.length} milestone(s) auto-completed from your previous progress.`
      : 'Path started'
  );
});

export const switchPath = asyncHandler(async (req, res) => {
  const { pathId } = req.body;
  const path = await LearningPath.findById(pathId);
  if (!path) throw ApiError.notFound('Learning path not found');

  await StudentProgress.updateMany(
    { userId: req.user._id, status: 'active' },
    { $set: { status: 'paused' } }
  );

  const existing = await StudentProgress.findOne({ userId: req.user._id, pathId });
  if (existing) {
    existing.status = 'active';
    await existing.save();
  }
  await User.findByIdAndUpdate(req.user._id, { activePathId: pathId });

  return ok(res, { switched: true, pathId }, `Switched to ${path.title}`);
});

/** All of a student's path progress records. */
export const myProgress = asyncHandler(async (req, res) => {
  const list = await StudentProgress.find({ userId: req.user._id })
    .populate('pathId')
    .sort({ updatedAt: -1 })
    .lean();

  const enriched = await Promise.all(
    list.map(async (p) => {
      if (!p.pathId) return null;
      const [totalLessons, totalMilestones] = await Promise.all([
        Lesson.countDocuments({ pathId: p.pathId._id }),
        Milestone.countDocuments({ pathId: p.pathId._id }),
      ]);
      const lessonsDone = (p.lessons || []).filter((l) => l.completed).length;
      const milestonesDone = (p.milestones || []).filter((m) => m.status === 'completed').length;
      const quizzesPassed = (p.lessons || []).filter((l) => l.quizPassed).length;
      const proofs = (p.milestones || []).filter((m) => m.proofSubmitted).length;
      const preparationScore = Math.min(
        100,
        Math.round(
          (totalLessons ? (lessonsDone / totalLessons) * 45 : 0) +
            (totalMilestones ? (milestonesDone / totalMilestones) * 30 : 0) +
            (totalLessons ? (quizzesPassed / totalLessons) * 15 : 0) +
            (totalMilestones ? (proofs / totalMilestones) * 10 : 0)
        )
      );
      return {
        ...p,
        totals: { totalLessons, totalMilestones, lessonsDone, milestonesDone },
        percent: totalLessons ? Math.round((lessonsDone / totalLessons) * 100) : 0,
        preparationScore,
      };
    })
  );

  return ok(res, { progress: enriched.filter(Boolean) });
});

/** Complete a milestone (optionally with proof of work). */
export const completeMilestone = asyncHandler(async (req, res) => {
  const { milestoneId } = req.params;
  const { proofUrl = '' } = req.body || {};

  const milestone = await Milestone.findById(milestoneId);
  if (!milestone) throw ApiError.notFound('Milestone not found');

  const progress = await StudentProgress.findOne({
    userId: req.user._id,
    pathId: milestone.pathId,
  });
  if (!progress) throw ApiError.badRequest('Start this path before completing milestones');

  const entry = progress.milestones.find((m) => String(m.milestoneId) === String(milestoneId));
  if (entry) {
    entry.status = 'completed';
    entry.completedAt = new Date();
    if (proofUrl) {
      entry.proofSubmitted = true;
      entry.proofUrl = proofUrl;
    }
  } else {
    progress.milestones.push({
      milestoneId,
      status: 'completed',
      completedAt: new Date(),
      proofSubmitted: Boolean(proofUrl),
      proofUrl,
    });
  }

  // Record topics for cross-path transfer
  (milestone.topicTags || []).forEach((t) => {
    const key = t.toLowerCase();
    if (!progress.completedTopics.includes(key)) progress.completedTopics.push(key);
  });

  // Unlock next milestone
  const all = await Milestone.find({ pathId: milestone.pathId }).sort({ order: 1 });
  const next = all.find((m) => m.order > milestone.order);
  if (next) {
    const nextEntry = progress.milestones.find((m) => String(m.milestoneId) === String(next._id));
    if (nextEntry && nextEntry.status === 'locked') nextEntry.status = 'current';
    else if (!nextEntry) progress.milestones.push({ milestoneId: next._id, status: 'current' });
  }

  await progress.save();
  return ok(res, { progress, nextMilestone: next || null }, 'Milestone completed');
});

/** Milestone detail + related opportunities (used by the 3D orbit panel). */
export const getMilestone = asyncHandler(async (req, res) => {
  const milestone = await Milestone.findById(req.params.id).lean();
  if (!milestone) throw ApiError.notFound('Milestone not found');

  const lessons = await Lesson.find({ milestoneId: milestone._id }).sort({ order: 1 }).lean();

  const tags = milestone.relatedOpportunityTags || [];
  const related = tags.length
    ? await Opportunity.find({
        status: 'published',
        $or: [{ tags: { $in: tags } }, { skillsRequired: { $in: tags } }],
      })
        .limit(4)
        .lean()
    : [];

  const all = await Milestone.find({ pathId: milestone.pathId }).sort({ order: 1 }).lean();
  const next = all.find((m) => m.order > milestone.order) || null;

  return ok(res, { milestone, lessons, relatedOpportunities: related, nextMilestone: next });
});
