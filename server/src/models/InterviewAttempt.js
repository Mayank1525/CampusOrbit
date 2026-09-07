import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema(
  {
    technicalAccuracy: { type: Number, default: 0 }, // 0-10
    clarity: { type: Number, default: 0 },
    structure: { type: Number, default: 0 },
    overall: { type: Number, default: 0 },
    missingConcepts: { type: [String], default: [] },
    usedProjectExample: { type: Boolean, default: false },
    strengths: { type: [String], default: [] },
    improvedAnswerOutline: { type: [String], default: [] },
    recommendedNextTopic: { type: String, default: '' },
    verdict: { type: String, default: '' },
    mode: { type: String, enum: ['demo', 'live-ai'], default: 'demo' },
  },
  { _id: false }
);

const interviewAttemptSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewQuestion', required: true },
    questionText: { type: String, default: '' },
    role: { type: String, default: '' },
    topic: { type: String, default: '' },
    difficulty: { type: String, default: 'medium' },
    answerText: { type: String, required: true },
    wordCount: { type: Number, default: 0 },
    resumeContextId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', default: null },
    feedback: { type: feedbackSchema, default: () => ({}) },
    sessionId: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('InterviewAttempt', interviewAttemptSchema);
