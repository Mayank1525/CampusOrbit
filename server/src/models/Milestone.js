import mongoose from 'mongoose';

const milestoneSchema = new mongoose.Schema(
  {
    pathId: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningPath', required: true, index: true },
    title: { type: String, required: true },
    slug: { type: String, required: true, lowercase: true },
    order: { type: Number, required: true },
    description: { type: String, default: '' },
    whyItMatters: { type: String, default: '' },
    prerequisites: { type: [String], default: [] },
    estimatedHours: { type: Number, default: 8 },
    recommendedResource: {
      label: { type: String, default: '' },
      url: { type: String, default: '' },
      type: { type: String, default: 'video' },
    },
    practiceTask: { type: String, default: '' },
    proofTask: { type: String, default: '' },
    whatComesNext: { type: String, default: '' },
    topicTags: { type: [String], default: [] },
    relatedOpportunityTags: { type: [String], default: [] },
    orbit: {
      radius: { type: Number, default: 4 },
      angle: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

milestoneSchema.index({ pathId: 1, order: 1 });

milestoneSchema.virtual('lessons', {
  ref: 'Lesson',
  localField: '_id',
  foreignField: 'milestoneId',
});

export default mongoose.model('Milestone', milestoneSchema);
