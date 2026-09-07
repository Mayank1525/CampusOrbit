import { z } from 'zod';
import { User, StudentProgress, Application, Document, Resume } from '../models/index.js';
import { ok, ApiError, asyncHandler } from '../utils/apiResponse.js';

export const profileSchema = z.object({
  fullName: z.string().min(2).max(80).optional(),
  profile: z
    .object({
      college: z.string().max(120).optional(),
      branch: z.string().max(40).optional(),
      graduationYear: z.coerce.number().int().min(2000).max(2100).nullable().optional(),
      cgpa: z.coerce.number().min(0).max(10).nullable().optional(),
      backlogCount: z.coerce.number().int().min(0).max(50).optional(),
      skills: z.array(z.string().max(40)).max(40).optional(),
      currentLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      weeklyStudyHours: z.coerce.number().min(1).max(80).optional(),
      careerGoals: z.array(z.string().max(60)).max(10).optional(),
      examGoals: z.array(z.string().max(60)).max(10).optional(),
      preferredLanguage: z.enum(['English', 'Hindi', 'Hinglish']).optional(),
      githubUrl: z.string().max(200).optional(),
      linkedinUrl: z.string().max(200).optional(),
      codingProfileUrl: z.string().max(200).optional(),
      portfolioUrl: z.string().max(200).optional(),
      phone: z.string().max(20).optional(),
      location: z.string().max(80).optional(),
      bio: z.string().max(500).optional(),
    })
    .optional(),
  onboardingCompleted: z.boolean().optional(),
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw ApiError.notFound('User not found');

  if (req.body.fullName) user.fullName = req.body.fullName;
  if (typeof req.body.onboardingCompleted === 'boolean') {
    user.onboardingCompleted = req.body.onboardingCompleted;
  }
  if (req.body.profile) {
    user.profile = { ...user.profile.toObject(), ...req.body.profile };
  }

  await user.save();
  const obj = user.toObject({ virtuals: true });
  delete obj.password;
  return ok(res, { user: obj }, 'Profile updated');
});

export const getProfileStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const [progressList, applications, documents, resumes] = await Promise.all([
    StudentProgress.find({ userId }),
    Application.countDocuments({ userId }),
    Document.countDocuments({ userId }),
    Resume.countDocuments({ userId }),
  ]);

  return ok(res, {
    profileCompletion: req.user.profileCompletion(),
    pathsStarted: progressList.length,
    applications,
    documents,
    resumes,
    streak: req.user.streak,
  });
});

/** Admin: list students with filters. */
export const listStudents = asyncHandler(async (req, res) => {
  const { search = '', branch, graduationYear, minCgpa, maxBacklogs, role } = req.query;
  const query = {};
  if (role) query.role = role;
  else query.role = { $in: ['student', 'senior'] };

  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { 'profile.college': { $regex: search, $options: 'i' } },
    ];
  }
  if (branch) query['profile.branch'] = branch;
  if (graduationYear) query['profile.graduationYear'] = Number(graduationYear);
  if (minCgpa) query['profile.cgpa'] = { $gte: Number(minCgpa) };
  if (maxBacklogs !== undefined && maxBacklogs !== '') {
    query['profile.backlogCount'] = { $lte: Number(maxBacklogs) };
  }

  const students = await User.find(query).sort({ createdAt: -1 }).limit(300);
  const data = students.map((s) => {
    const o = s.toObject({ virtuals: true });
    delete o.password;
    return o;
  });
  return ok(res, { students: data, count: data.length });
});

export const toggleStudentActive = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('Student not found');
  if (user.role === 'admin') throw ApiError.forbidden('Cannot deactivate an admin account');
  user.isActive = !user.isActive;
  await user.save({ validateBeforeSave: false });
  return ok(res, { id: user._id, isActive: user.isActive }, 'Student status updated');
});

/** Public-safe profile (used by peer rooms / senior contributions). */
export const getPublicProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(
    'fullName role avatarColor profile.college profile.branch profile.skills profile.githubUrl profile.linkedinUrl profile.portfolioUrl createdAt'
  );
  if (!user) throw ApiError.notFound('User not found');
  return ok(res, { user });
});
