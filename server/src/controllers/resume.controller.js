import { z } from 'zod';
import { Resume, User } from '../models/index.js';
import { RESUME_TEMPLATES } from '../models/Resume.js';
import { ok, created, ApiError, asyncHandler } from '../utils/apiResponse.js';

export const resumeSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  template: z.enum(RESUME_TEMPLATES).optional(),
  accentColor: z.string().max(20).optional(),
  personal: z.object({}).passthrough().optional(),
  summary: z.string().max(2000).optional(),
  education: z.array(z.object({}).passthrough()).optional(),
  skills: z.array(z.object({}).passthrough()).optional(),
  projects: z.array(z.object({}).passthrough()).optional(),
  experience: z.array(z.object({}).passthrough()).optional(),
  internships: z.array(z.object({}).passthrough()).optional(),
  certificates: z.array(z.object({}).passthrough()).optional(),
  achievements: z.array(z.string()).optional(),
  codingProfiles: z.array(z.object({}).passthrough()).optional(),
  languages: z.array(z.string()).optional(),
  links: z.array(z.object({}).passthrough()).optional(),
});

const withScore = (r) => {
  const obj = r.toObject ? r.toObject({ virtuals: true }) : r;
  return obj;
};

export const listResumes = asyncHandler(async (req, res) => {
  const resumes = await Resume.find({ userId: req.user._id }).sort({ isDefault: -1, updatedAt: -1 });
  return ok(res, {
    resumes: resumes.map(withScore),
    templates: RESUME_TEMPLATES,
  });
});

export const getResume = asyncHandler(async (req, res) => {
  const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id });
  if (!resume) throw ApiError.notFound('Resume not found');
  return ok(res, { resume: withScore(resume) });
});

/** Create a resume, prefilled from the student's profile. */
export const createResume = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const count = await Resume.countDocuments({ userId: user._id });

  const resume = await Resume.create({
    userId: user._id,
    name: req.body.name || `Resume ${count + 1}`,
    template: req.body.template || 'orbit-modern',
    accentColor: req.body.accentColor || '#7c5cff',
    isDefault: count === 0,
    personal: {
      fullName: user.fullName,
      title: user.profile?.careerGoals?.[0] || 'Aspiring Software Engineer',
      email: user.email,
      phone: user.profile?.phone || '',
      location: user.profile?.location || '',
      github: user.profile?.githubUrl || '',
      linkedin: user.profile?.linkedinUrl || '',
      portfolio: user.profile?.portfolioUrl || '',
      ...(req.body.personal || {}),
    },
    summary: req.body.summary || '',
    education: req.body.education?.length
      ? req.body.education
      : [
          {
            institution: user.profile?.college || '',
            degree: 'B.Tech',
            field: user.profile?.branch || '',
            startYear: '',
            endYear: user.profile?.graduationYear ? String(user.profile.graduationYear) : '',
            score: user.profile?.cgpa ? `${user.profile.cgpa} CGPA` : '',
          },
        ],
    skills: req.body.skills?.length
      ? req.body.skills
      : [{ category: 'Technical Skills', items: user.profile?.skills || [] }],
    projects: req.body.projects || [],
    experience: req.body.experience || [],
    internships: req.body.internships || [],
    certificates: req.body.certificates || [],
    achievements: req.body.achievements || [],
    codingProfiles: user.profile?.codingProfileUrl
      ? [{ platform: 'Coding profile', url: user.profile.codingProfileUrl, rating: '' }]
      : [],
    languages: req.body.languages || ['English', 'Hindi'],
    links: req.body.links || [],
  });

  return created(res, { resume: withScore(resume) }, 'Resume created');
});

export const updateResume = asyncHandler(async (req, res) => {
  const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id });
  if (!resume) throw ApiError.notFound('Resume not found');

  Object.entries(req.body).forEach(([k, v]) => {
    if (v !== undefined && k !== 'userId' && k !== '_id') resume[k] = v;
  });
  await resume.save();
  return ok(res, { resume: withScore(resume) }, 'Resume saved');
});

/** Duplicate keeps all data — used for role-specific versions. */
export const duplicateResume = asyncHandler(async (req, res) => {
  const source = await Resume.findOne({ _id: req.params.id, userId: req.user._id }).lean();
  if (!source) throw ApiError.notFound('Resume not found');

  delete source._id;
  delete source.createdAt;
  delete source.updatedAt;
  delete source.id;

  const copy = await Resume.create({
    ...source,
    name: `${source.name} (copy)`,
    isDefault: false,
  });
  return created(res, { resume: withScore(copy) }, 'Resume duplicated');
});

export const setDefaultResume = asyncHandler(async (req, res) => {
  const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id });
  if (!resume) throw ApiError.notFound('Resume not found');

  await Resume.updateMany({ userId: req.user._id }, { $set: { isDefault: false } });
  resume.isDefault = true;
  await resume.save();
  return ok(res, { resume: withScore(resume) }, `"${resume.name}" is now your default resume`);
});

export const deleteResume = asyncHandler(async (req, res) => {
  const resume = await Resume.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!resume) throw ApiError.notFound('Resume not found');

  if (resume.isDefault) {
    const next = await Resume.findOne({ userId: req.user._id }).sort({ updatedAt: -1 });
    if (next) {
      next.isDefault = true;
      await next.save();
    }
  }
  return ok(res, { id: req.params.id }, 'Resume deleted');
});
