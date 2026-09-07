import mongoose from 'mongoose';

const interviewQuestionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    role: { type: String, default: 'MERN Developer', index: true },
    topic: { type: String, default: 'General' },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
      index: true,
    },
    category: {
      type: String,
      enum: ['technical', 'project', 'hr', 'aptitude', 'exam'],
      default: 'technical',
    },
    idealAnswerOutline: { type: [String], default: [] },
    mustMentionKeywords: { type: [String], default: [] },
    followUps: { type: [String], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('InterviewQuestion', interviewQuestionSchema);
