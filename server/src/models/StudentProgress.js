import mongoose from 'mongoose';

const lessonProgressSchema = new mongoose.Schema(
  {
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
    milestoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Milestone' },
    watchedSeconds: { type: Number, default: 0 },
    lastTimestamp: { type: Number, default: 0 },
    percent: { type: Number, default: 0 },
    quizPassed: { type: Boolean, default: false },
    practiceDone: { type: Boolean, default: false },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const milestoneProgressSchema = new mongoose.Schema(
  {
    milestoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Milestone', required: true },
    status: {
      type: String,
      enum: ['locked', 'current', 'in-progress', 'completed'],
      default: 'locked',
    },
    completedAt: { type: Date, default: null },
    proofSubmitted: { type: Boolean, default: false },
    proofUrl: { type: String, default: '' },
  },
  { _id: false }
);

const studentProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pathId: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningPath', required: true, index: true },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed'],
      default: 'active',
    },
    startedAt: { type: Date, default: Date.now },
    targetTimelineWeeks: { type: Number, default: 12 },
    weeklyHours: { type: Number, default: 10 },
    lessons: { type: [lessonProgressSchema], default: [] },
    milestones: { type: [milestoneProgressSchema], default: [] },
    completedTopics: { type: [String], default: [] },
    recommendationReason: { type: String, default: '' },
    lastAccessedLessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', default: null },
  },
  { timestamps: true }
);

studentProgressSchema.index({ userId: 1, pathId: 1 }, { unique: true });

/** Preparation score (NOT a job-selection probability). */
studentProgressSchema.methods.preparationScore = function preparationScore(totalLessons, totalMilestones) {
  const lessonsDone = this.lessons.filter((l) => l.completed).length;
  const milestonesDone = this.milestones.filter((m) => m.status === 'completed').length;
  const quizzesPassed = this.lessons.filter((l) => l.quizPassed).length;
  const proofs = this.milestones.filter((m) => m.proofSubmitted).length;

  const lessonPart = totalLessons ? (lessonsDone / totalLessons) * 45 : 0;
  const milestonePart = totalMilestones ? (milestonesDone / totalMilestones) * 30 : 0;
  const quizPart = totalLessons ? (quizzesPassed / totalLessons) * 15 : 0;
  const proofPart = totalMilestones ? (proofs / totalMilestones) * 10 : 0;

  return Math.min(100, Math.round(lessonPart + milestonePart + quizPart + proofPart));
};

export default mongoose.model('StudentProgress', studentProgressSchema);
