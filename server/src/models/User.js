import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const profileSchema = new mongoose.Schema(
  {
    college: { type: String, default: '' },
    branch: { type: String, default: '' },
    graduationYear: { type: Number, default: null },
    cgpa: { type: Number, default: null },
    backlogCount: { type: Number, default: 0 },
    skills: { type: [String], default: [] },
    currentLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    weeklyStudyHours: { type: Number, default: 10 },
    careerGoals: { type: [String], default: [] },
    examGoals: { type: [String], default: [] },
    preferredLanguage: {
      type: String,
      enum: ['English', 'Hindi', 'Hinglish'],
      default: 'English',
    },
    githubUrl: { type: String, default: '' },
    linkedinUrl: { type: String, default: '' },
    codingProfileUrl: { type: String, default: '' },
    portfolioUrl: { type: String, default: '' },
    phone: { type: String, default: '' },
    location: { type: String, default: '' },
    bio: { type: String, default: '' },
  },
  { _id: false }
);

const streakSchema = new mongoose.Schema(
  {
    current: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    lastActiveDate: { type: Date, default: null },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      minlength: 6,
      select: false,
      required: true,
    },
    avatarUrl: { type: String, default: '' },
    role: {
      type: String,
      enum: ['student', 'admin', 'senior'],
      default: 'student',
      index: true,
    },
    avatarColor: { type: String, default: '#7c5cff' },
    profile: { type: profileSchema, default: () => ({}) },
    onboardingCompleted: { type: Boolean, default: false },
    activePathId: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningPath', default: null },
    streak: { type: streakSchema, default: () => ({}) },
    bookmarkedOpportunities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity' }],
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  // Google-only accounts have no password hash — never let bcrypt compare
  // against undefined (it would throw and leak a 500 instead of a clean 401).
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

/** True when the user can sign in with a password. */
userSchema.methods.hasPassword = function hasPassword() {
  return Boolean(this.password);
};

/** Explainable profile-completion score (0-100). */
userSchema.methods.profileCompletion = function profileCompletion() {
  const p = this.profile || {};
  const checks = [
    Boolean(this.fullName),
    Boolean(this.email),
    Boolean(p.college),
    Boolean(p.branch),
    Boolean(p.graduationYear),
    p.cgpa !== null && p.cgpa !== undefined,
    Array.isArray(p.skills) && p.skills.length >= 3,
    Boolean(p.currentLevel),
    Boolean(p.weeklyStudyHours),
    Array.isArray(p.careerGoals) && p.careerGoals.length > 0,
    Boolean(p.githubUrl),
    Boolean(p.linkedinUrl),
    Boolean(p.codingProfileUrl),
    Boolean(p.portfolioUrl),
    Boolean(p.phone),
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
};

userSchema.virtual('profileCompletionScore').get(function getScore() {
  return this.profileCompletion();
});

export default mongoose.model('User', userSchema);
