import { z } from 'zod';
import {
  User,
  Opportunity,
  Application,
  LearningPath,
  Milestone,
  Lesson,
  StudentProgress,
  PeerRoom,
  Message,
  Note,
  QuizAttempt,
  InterviewAttempt,
} from '../models/index.js';
import { APPLICATION_STAGES } from '../models/Application.js';
import { ok, created, ApiError, asyncHandler } from '../utils/apiResponse.js';

/** Admin dashboard analytics. */
export const analytics = asyncHandler(async (req, res) => {
  const now = new Date();
  const in7Days = new Date(Date.now() + 7 * 86400000);

  const [
    totalStudents,
    activeStudents,
    totalOpportunities,
    activeOpportunities,
    totalApplications,
    opportunities,
    applications,
    students,
    rooms,
    pendingNotes,
    quizAttempts,
    interviewAttempts,
  ] = await Promise.all([
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'student', isActive: true }),
    Opportunity.countDocuments(),
    Opportunity.countDocuments({ status: 'published', deadline: { $gte: now } }),
    Application.countDocuments(),
    Opportunity.find().lean(),
    Application.find().populate('opportunityId', 'title company').populate('userId', 'profile fullName').lean(),
    User.find({ role: 'student' }).lean(),
    PeerRoom.countDocuments({ isArchived: false }),
    Note.countDocuments({ kind: 'ai', status: 'draft' }),
    QuizAttempt.countDocuments(),
    InterviewAttempt.countDocuments(),
  ]);

  // Applications per company
  const perCompany = {};
  applications.forEach((a) => {
    const c = a.opportunityId?.company || 'Unknown';
    perCompany[c] = (perCompany[c] || 0) + 1;
  });
  const applicationsPerCompany = Object.entries(perCompany)
    .map(([company, count]) => ({ company, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Round-wise conversion
  const stageCounts = APPLICATION_STAGES.reduce((acc, s) => {
    acc[s] = applications.filter((a) => a.stage === s).length;
    return acc;
  }, {});
  const applied = applications.filter((a) => !['Saved', 'Preparing'].includes(a.stage)).length;
  const roundConversion = APPLICATION_STAGES.map((s) => ({
    stage: s,
    count: stageCounts[s],
    conversionFromApplied: applied ? Math.round((stageCounts[s] / applied) * 100) : 0,
  }));

  // Most in-demand skills (from published opportunities)
  const skillFreq = {};
  opportunities
    .filter((o) => o.status === 'published')
    .forEach((o) => {
      (o.skillsRequired || []).forEach((s) => {
        const k = s.toLowerCase();
        skillFreq[k] = (skillFreq[k] || 0) + 1;
      });
    });
  const inDemandSkills = Object.entries(skillFreq)
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Skill gap: demanded vs. supplied by students
  const studentSkillFreq = {};
  students.forEach((s) => {
    (s.profile?.skills || []).forEach((sk) => {
      const k = sk.toLowerCase();
      studentSkillFreq[k] = (studentSkillFreq[k] || 0) + 1;
    });
  });
  const skillGap = inDemandSkills.map((s) => ({
    skill: s.skill,
    demand: s.count,
    studentsWithSkill: studentSkillFreq[s.skill] || 0,
    gapPercent: totalStudents
      ? Math.round((1 - (studentSkillFreq[s.skill] || 0) / totalStudents) * 100)
      : 0,
  }));

  // Profile completion distribution
  const completionBuckets = { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 };
  const completions = students.map((s) => {
    const p = s.profile || {};
    const checks = [
      Boolean(s.fullName),
      Boolean(s.email),
      Boolean(p.college),
      Boolean(p.branch),
      Boolean(p.graduationYear),
      p.cgpa !== null && p.cgpa !== undefined,
      (p.skills || []).length >= 3,
      Boolean(p.currentLevel),
      Boolean(p.weeklyStudyHours),
      (p.careerGoals || []).length > 0,
      Boolean(p.githubUrl),
      Boolean(p.linkedinUrl),
      Boolean(p.codingProfileUrl),
      Boolean(p.portfolioUrl),
      Boolean(p.phone),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  });
  completions.forEach((c) => {
    if (c <= 25) completionBuckets['0-25'] += 1;
    else if (c <= 50) completionBuckets['26-50'] += 1;
    else if (c <= 75) completionBuckets['51-75'] += 1;
    else completionBuckets['76-100'] += 1;
  });

  // Eligible students per drive
  const eligibilityPerDrive = opportunities
    .filter((o) => o.status === 'published')
    .map((o) => {
      const rules = o.eligibility || {};
      const eligible = students.filter((s) => {
        const p = s.profile || {};
        if (rules.minCgpa && (p.cgpa ?? 0) < rules.minCgpa) return false;
        if (rules.allowedBranches?.length && !rules.allowedBranches.includes(p.branch)) return false;
        if (rules.allowedGraduationYears?.length && !rules.allowedGraduationYears.includes(p.graduationYear))
          return false;
        if (rules.maxBacklogs !== undefined && (p.backlogCount ?? 0) > rules.maxBacklogs) return false;
        return true;
      }).length;
      return {
        _id: o._id,
        title: o.title,
        company: o.company,
        eligible,
        applied: applications.filter((a) => String(a.opportunityId?._id) === String(o._id)).length,
      };
    })
    .sort((a, b) => b.eligible - a.eligible)
    .slice(0, 10);

  const upcomingDeadlines = opportunities
    .filter((o) => o.status === 'published' && new Date(o.deadline) >= now && new Date(o.deadline) <= in7Days)
    .map((o) => ({
      _id: o._id,
      title: o.title,
      company: o.company,
      deadline: o.deadline,
      daysLeft: Math.ceil((new Date(o.deadline) - now) / 86400000),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const shortlisted = applications.filter((a) =>
    ['Shortlisted', 'Assessment', 'Technical Round', 'HR Round', 'Selected'].includes(a.stage)
  );

  return ok(res, {
    kpis: {
      totalStudents,
      activeStudents,
      totalOpportunities,
      activeOpportunities,
      totalApplications,
      shortlistedCount: shortlisted.length,
      selectedCount: applications.filter((a) => a.stage === 'Selected').length,
      rooms,
      pendingNoteReviews: pendingNotes,
      quizAttempts,
      interviewAttempts,
      averageProfileCompletion: completions.length
        ? Math.round(completions.reduce((a, b) => a + b, 0) / completions.length)
        : 0,
    },
    applicationsPerCompany,
    roundConversion,
    inDemandSkills,
    skillGap,
    profileCompletionDistribution: Object.entries(completionBuckets).map(([range, count]) => ({ range, count })),
    eligibilityPerDrive,
    upcomingDeadlines,
    shortlistedStudents: shortlisted.slice(0, 20).map((a) => ({
      _id: a._id,
      student: a.userId?.fullName,
      opportunity: a.opportunityId?.title,
      company: a.opportunityId?.company,
      stage: a.stage,
    })),
  });
});

/** ---- Learning path CRUD ---- */

export const pathSchema = z.object({
  title: z.string().min(3),
  tagline: z.string().optional(),
  description: z.string().optional(),
  goalTags: z.array(z.string()).optional(),
  category: z.enum(['placement', 'exam', 'internship', 'skill']).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  estimatedWeeks: z.coerce.number().min(1).max(104).optional(),
  recommendedWeeklyHours: z.coerce.number().min(1).max(80).optional(),
  accentColor: z.string().optional(),
  outcomes: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
});

export const createPath = asyncHandler(async (req, res) => {
  const slug = req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const exists = await LearningPath.findOne({ slug });
  if (exists) throw ApiError.conflict('A path with this name already exists');

  const path = await LearningPath.create({ ...req.body, slug, createdBy: req.user._id });
  return created(res, { path }, 'Learning path created');
});

export const updatePath = asyncHandler(async (req, res) => {
  const path = await LearningPath.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!path) throw ApiError.notFound('Path not found');
  return ok(res, { path }, 'Path updated');
});

export const deletePath = asyncHandler(async (req, res) => {
  const path = await LearningPath.findByIdAndDelete(req.params.id);
  if (!path) throw ApiError.notFound('Path not found');
  await Promise.all([
    Milestone.deleteMany({ pathId: path._id }),
    Lesson.deleteMany({ pathId: path._id }),
    StudentProgress.deleteMany({ pathId: path._id }),
  ]);
  return ok(res, { id: req.params.id }, 'Path and its content deleted');
});

/** ---- Milestone CRUD ---- */

export const milestoneSchema = z.object({
  pathId: z.string().min(1),
  title: z.string().min(3),
  order: z.coerce.number().optional(),
  description: z.string().optional(),
  whyItMatters: z.string().optional(),
  prerequisites: z.array(z.string()).optional(),
  estimatedHours: z.coerce.number().optional(),
  practiceTask: z.string().optional(),
  proofTask: z.string().optional(),
  whatComesNext: z.string().optional(),
  topicTags: z.array(z.string()).optional(),
  relatedOpportunityTags: z.array(z.string()).optional(),
  recommendedResource: z
    .object({ label: z.string().optional(), url: z.string().optional(), type: z.string().optional() })
    .optional(),
});

export const createMilestone = asyncHandler(async (req, res) => {
  const path = await LearningPath.findById(req.body.pathId);
  if (!path) throw ApiError.notFound('Path not found');

  const count = await Milestone.countDocuments({ pathId: path._id });
  const order = req.body.order ?? count + 1;
  const slug = req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const milestone = await Milestone.create({
    ...req.body,
    slug: `${slug}-${Date.now().toString(36)}`,
    order,
    orbit: {
      radius: 3.2 + (order % 3) * 0.9,
      angle: (order - 1) * ((Math.PI * 2) / Math.max(6, count + 1)),
      height: ((order % 4) - 1.5) * 0.7,
    },
  });
  return created(res, { milestone }, 'Milestone created');
});

export const updateMilestone = asyncHandler(async (req, res) => {
  const milestone = await Milestone.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!milestone) throw ApiError.notFound('Milestone not found');
  return ok(res, { milestone }, 'Milestone updated');
});

export const deleteMilestone = asyncHandler(async (req, res) => {
  const milestone = await Milestone.findByIdAndDelete(req.params.id);
  if (!milestone) throw ApiError.notFound('Milestone not found');
  await Lesson.deleteMany({ milestoneId: milestone._id });
  return ok(res, { id: req.params.id }, 'Milestone deleted');
});

/** Student detail view for the placement cell. */
export const studentDetail = asyncHandler(async (req, res) => {
  const student = await User.findById(req.params.id).lean();
  if (!student) throw ApiError.notFound('Student not found');
  delete student.password;

  const [applications, progress, interviewAttempts, quizAttempts] = await Promise.all([
    Application.find({ userId: student._id }).populate('opportunityId', 'title company').lean(),
    StudentProgress.find({ userId: student._id }).populate('pathId', 'title').lean(),
    InterviewAttempt.countDocuments({ userId: student._id }),
    QuizAttempt.countDocuments({ userId: student._id }),
  ]);

  return ok(res, {
    student,
    applications,
    progress,
    stats: { interviewAttempts, quizAttempts },
    // NOTE: private documents are intentionally NOT returned here.
    privacyNote: 'Private student documents are never exposed through the admin API.',
  });
});
