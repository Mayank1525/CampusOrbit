import {
  StudentProgress,
  Lesson,
  Milestone,
  LearningPath,
  RevisionTask,
  Application,
  Opportunity,
  InterviewAttempt,
  Notification,
  PeerRoom,
  Message,
  QuizAttempt,
  Resume,
  Document,
} from '../models/index.js';
import { ok, asyncHandler } from '../utils/apiResponse.js';
import { matchScore } from '../services/eligibility.service.js';

/**
 * Student dashboard aggregate.
 * "Today's Orbit" deliberately returns AT MOST 3 priority tasks — the whole
 * point of CampusOrbit is removing choice-overload.
 */
export const studentDashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const now = new Date();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const in7Days = new Date(Date.now() + 7 * 86400000);

  const [activeProgress, revisions, applications, notifications, interviewAttempts, quizAttempts, resumes, documents] =
    await Promise.all([
      StudentProgress.findOne({ userId, status: 'active' }).populate('pathId').lean(),
      RevisionTask.find({ userId, status: 'pending', dueDate: { $lte: endOfToday } })
        .populate('lessonId', 'title slug')
        .sort({ dueDate: 1 })
        .lean(),
      Application.find({ userId }).populate('opportunityId', 'title company deadline type').lean(),
      Notification.find({ userId, read: false }).sort({ createdAt: -1 }).limit(8).lean(),
      InterviewAttempt.find({ userId }).sort({ createdAt: -1 }).limit(20).lean(),
      QuizAttempt.find({ userId }).sort({ createdAt: -1 }).limit(20).lean(),
      Resume.find({ userId }).lean(),
      Document.find({ userId }).lean(),
    ]);

  // ---- Orbit / path state ----
  let orbit = null;
  let currentMilestone = null;
  let nextLesson = null;
  let preparationScore = 0;

  if (activeProgress?.pathId) {
    const pathId = activeProgress.pathId._id;
    const [milestones, lessons] = await Promise.all([
      Milestone.find({ pathId }).sort({ order: 1 }).lean(),
      Lesson.find({ pathId }).sort({ order: 1 }).lean(),
    ]);

    const msMap = new Map((activeProgress.milestones || []).map((m) => [String(m.milestoneId), m]));
    const lsMap = new Map((activeProgress.lessons || []).map((l) => [String(l.lessonId), l]));

    orbit = {
      path: activeProgress.pathId,
      nodes: milestones.map((m) => {
        const state = msMap.get(String(m._id));
        const milestoneLessons = lessons.filter((l) => String(l.milestoneId) === String(m._id));
        const done = milestoneLessons.filter((l) => lsMap.get(String(l._id))?.completed).length;
        return {
          _id: m._id,
          title: m.title,
          order: m.order,
          description: m.description,
          whyItMatters: m.whyItMatters,
          estimatedHours: m.estimatedHours,
          status: state?.status || 'locked',
          lessonCount: milestoneLessons.length,
          lessonsCompleted: done,
          percent: milestoneLessons.length ? Math.round((done / milestoneLessons.length) * 100) : 0,
          orbitConfig: m.orbit,
        };
      }),
    };

    const currentNode = orbit.nodes.find((n) => n.status === 'current' || n.status === 'in-progress');
    if (currentNode) {
      currentMilestone = currentNode;
      const candidates = lessons.filter((l) => String(l.milestoneId) === String(currentNode._id));
      nextLesson = candidates.find((l) => !lsMap.get(String(l._id))?.completed) || null;
    }
    if (!nextLesson) {
      nextLesson = lessons.find((l) => !lsMap.get(String(l._id))?.completed) || null;
    }

    const lessonsDone = (activeProgress.lessons || []).filter((l) => l.completed).length;
    const milestonesDone = (activeProgress.milestones || []).filter((m) => m.status === 'completed').length;
    const quizzesPassed = (activeProgress.lessons || []).filter((l) => l.quizPassed).length;
    const proofs = (activeProgress.milestones || []).filter((m) => m.proofSubmitted).length;
    preparationScore = Math.min(
      100,
      Math.round(
        (lessons.length ? (lessonsDone / lessons.length) * 45 : 0) +
          (milestones.length ? (milestonesDone / milestones.length) * 30 : 0) +
          (lessons.length ? (quizzesPassed / lessons.length) * 15 : 0) +
          (milestones.length ? (proofs / milestones.length) * 10 : 0)
      )
    );

    orbit.totals = {
      lessons: lessons.length,
      lessonsDone,
      milestones: milestones.length,
      milestonesDone,
      percent: lessons.length ? Math.round((lessonsDone / lessons.length) * 100) : 0,
    };
  }

  // ---- Opportunity matches & deadlines ----
  const openOpportunities = await Opportunity.find({
    status: 'published',
    deadline: { $gte: now },
  }).lean();

  const matches = openOpportunities
    .map((o) => ({ opportunity: o, ...matchScore(req.user, o) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const appliedIds = new Set(applications.map((a) => String(a.opportunityId?._id)));
  const upcomingDeadlines = openOpportunities
    .filter((o) => new Date(o.deadline) <= in7Days)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 5)
    .map((o) => ({
      _id: o._id,
      title: o.title,
      company: o.company,
      deadline: o.deadline,
      applied: appliedIds.has(String(o._id)),
      daysLeft: Math.ceil((new Date(o.deadline) - now) / 86400000),
    }));

  // ---- Peer room activity ----
  const myRooms = await PeerRoom.find({ members: userId }).select('name slug accentColor').lean();
  const roomActivity = await Promise.all(
    myRooms.slice(0, 4).map(async (r) => ({
      ...r,
      recentMessages: await Message.countDocuments({
        roomId: r._id,
        createdAt: { $gte: new Date(Date.now() - 86400000) },
      }),
    }))
  );

  // ---- Today's Orbit: at most THREE priority tasks ----
  const candidates = [];

  if (revisions.length) {
    candidates.push({
      priority: 1,
      type: 'revision',
      title: `Revise: ${revisions[0].topic}`,
      body: `Spaced revision keeps this in long-term memory. ${revisions.length} revision task(s) due.`,
      action: 'Start revision',
      link: '/learn?tab=revision',
      icon: 'repeat',
    });
  }

  if (nextLesson) {
    candidates.push({
      priority: 2,
      type: 'lesson',
      title: `Continue: ${nextLesson.title}`,
      body: `One curated video, then the quiz. About ${nextLesson.estimatedMinutes} minutes.`,
      action: 'Open lesson',
      link: `/learn/${nextLesson._id}`,
      icon: 'play',
    });
  }

  const urgentDeadline = upcomingDeadlines.find((d) => !d.applied && d.daysLeft <= 5);
  if (urgentDeadline) {
    candidates.push({
      priority: 1,
      type: 'deadline',
      title: `Apply: ${urgentDeadline.title}`,
      body: `${urgentDeadline.company} closes in ${urgentDeadline.daysLeft} day(s).`,
      action: 'View opportunity',
      link: `/opportunities/${urgentDeadline._id}`,
      icon: 'alarm-clock',
    });
  }

  const profileCompletion = req.user.profileCompletion();
  if (profileCompletion < 80) {
    candidates.push({
      priority: 3,
      type: 'profile',
      title: 'Complete your profile',
      body: `Your profile is ${profileCompletion}% complete. Placement filters use these fields.`,
      action: 'Update profile',
      link: '/profile',
      icon: 'user-check',
    });
  }

  if (!resumes.length) {
    candidates.push({
      priority: 2,
      type: 'resume',
      title: 'Build your first resume',
      body: 'You need a resume before you can apply to any drive.',
      action: 'Open Resume Studio',
      link: '/resume-studio',
      icon: 'file-text',
    });
  }

  if (interviewAttempts.length < 3) {
    candidates.push({
      priority: 4,
      type: 'interview',
      title: 'Practise one interview question',
      body: 'Written practice builds the muscle for the real thing.',
      action: 'Start practice',
      link: '/interview-practice',
      icon: 'message-square',
    });
  }

  const todaysOrbit = candidates.sort((a, b) => a.priority - b.priority).slice(0, 3);

  // ---- "What should I do next?" single recommendation ----
  const top = todaysOrbit[0];
  const whatNext = top
    ? {
        headline: top.title,
        reason: top.body,
        action: top.action,
        link: top.link,
        type: top.type,
      }
    : {
        headline: 'You are on track 🎯',
        reason: 'No urgent tasks. Move ahead on your path or attempt a harder interview question.',
        action: 'Open my path',
        link: '/my-path',
        type: 'idle',
      };

  // ---- Interview progress ----
  const interviewStats = {
    total: interviewAttempts.length,
    averageOverall: interviewAttempts.length
      ? Math.round(
          (interviewAttempts.reduce((s, a) => s + (a.feedback?.overall || 0), 0) / interviewAttempts.length) * 10
        ) / 10
      : 0,
    lastAttemptAt: interviewAttempts[0]?.createdAt || null,
  };

  const applicationSummary = applications.reduce((acc, a) => {
    acc[a.stage] = (acc[a.stage] || 0) + 1;
    return acc;
  }, {});

  return ok(res, {
    greeting: {
      name: req.user.fullName.split(' ')[0],
      role: req.user.role,
      preferredLanguage: req.user.profile?.preferredLanguage || 'English',
    },
    profileCompletion,
    todaysOrbit,
    whatNext,
    orbit,
    currentMilestone,
    nextLesson,
    preparationScore,
    revisions: revisions.slice(0, 5),
    revisionCount: revisions.length,
    upcomingDeadlines,
    matches,
    applicationSummary,
    applicationTotal: applications.length,
    interviewStats,
    roomActivity,
    notifications,
    streak: req.user.streak,
    counts: {
      resumes: resumes.length,
      documents: documents.length,
      quizAttempts: quizAttempts.length,
    },
  });
});

/** Progress charts data. */
export const progressCharts = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const days = 30;
  const since = new Date(Date.now() - days * 86400000);

  const [quizAttempts, interviewAttempts, revisions] = await Promise.all([
    QuizAttempt.find({ userId, createdAt: { $gte: since } }).lean(),
    InterviewAttempt.find({ userId, createdAt: { $gte: since } }).lean(),
    RevisionTask.find({ userId, completedAt: { $gte: since } }).lean(),
  ]);

  const buckets = {};
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = { date: key, quizzes: 0, interviews: 0, revisions: 0, score: 0 };
  }

  quizAttempts.forEach((a) => {
    const key = new Date(a.createdAt).toISOString().slice(0, 10);
    if (buckets[key]) {
      buckets[key].quizzes += 1;
      buckets[key].score = Math.max(buckets[key].score, a.percent);
    }
  });
  interviewAttempts.forEach((a) => {
    const key = new Date(a.createdAt).toISOString().slice(0, 10);
    if (buckets[key]) buckets[key].interviews += 1;
  });
  revisions.forEach((r) => {
    if (!r.completedAt) return;
    const key = new Date(r.completedAt).toISOString().slice(0, 10);
    if (buckets[key]) buckets[key].revisions += 1;
  });

  const progressList = await StudentProgress.find({ userId }).populate('pathId', 'title accentColor').lean();
  const pathBreakdown = await Promise.all(
    progressList
      .filter((p) => p.pathId)
      .map(async (p) => {
        const total = await Lesson.countDocuments({ pathId: p.pathId._id });
        const done = (p.lessons || []).filter((l) => l.completed).length;
        return {
          name: p.pathId.title,
          completed: done,
          remaining: Math.max(0, total - done),
          percent: total ? Math.round((done / total) * 100) : 0,
          color: p.pathId.accentColor,
        };
      })
  );

  return ok(res, {
    daily: Object.values(buckets),
    pathBreakdown,
    quizPerformance: quizAttempts
      .slice(-10)
      .map((a, i) => ({ attempt: i + 1, percent: a.percent, passed: a.passed })),
  });
});
