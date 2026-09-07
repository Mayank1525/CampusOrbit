import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    options: {
      type: [String],
      validate: [(v) => v.length >= 2, 'At least two options required'],
    },
    correctIndex: { type: Number, required: true },
    explanation: { type: String, default: '' },
    topic: { type: String, default: '' },
  },
  { _id: true }
);

const quizSchema = new mongoose.Schema(
  {
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', index: true },
    milestoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Milestone', default: null },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    questions: { type: [questionSchema], default: [] },
    passPercent: { type: Number, default: 60 },
    generationMode: { type: String, enum: ['demo', 'live-ai', 'human'], default: 'demo' },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Quiz', quizSchema);
