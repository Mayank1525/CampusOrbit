import mongoose from 'mongoose';

const learningPathSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    tagline: { type: String, default: '' },
    description: { type: String, default: '' },
    goalTags: { type: [String], default: [] },
    category: {
      type: String,
      enum: ['placement', 'exam', 'internship', 'skill'],
      default: 'placement',
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    estimatedWeeks: { type: Number, default: 12 },
    recommendedWeeklyHours: { type: Number, default: 10 },
    accentColor: { type: String, default: '#7c5cff' },
    icon: { type: String, default: 'rocket' },
    outcomes: { type: [String], default: [] },
    isPublished: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

learningPathSchema.virtual('milestones', {
  ref: 'Milestone',
  localField: '_id',
  foreignField: 'pathId',
});

export default mongoose.model('LearningPath', learningPathSchema);
