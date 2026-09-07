import mongoose from 'mongoose';

const primaryVideoSchema = new mongoose.Schema(
  {
    youtubeVideoId: { type: String, required: true },
    title: { type: String, required: true },
    channelName: { type: String, default: '' },
    duration: { type: Number, default: 0 }, // seconds
    thumbnail: { type: String, default: '' },
    reasonForRecommendation: { type: String, default: '' },
    verifiedBy: { type: String, default: 'CampusOrbit Placement Cell' },
    isEmbeddable: { type: Boolean, default: true },
  },
  { _id: false }
);

const lessonSchema = new mongoose.Schema(
  {
    milestoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Milestone', required: true, index: true },
    pathId: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningPath', required: true, index: true },
    title: { type: String, required: true },
    slug: { type: String, required: true, lowercase: true },
    order: { type: Number, default: 1 },
    summary: { type: String, default: '' },
    topic: { type: String, default: '' },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    estimatedMinutes: { type: Number, default: 30 },
    // Exactly ONE curated primary video per lesson/topic.
    primaryVideo: { type: primaryVideoSchema, required: true },
    // Authorized transcript provided by admin -> the only legal source for AI notes.
    authorizedTranscript: { type: String, default: '' },
    transcriptSource: {
      type: String,
      enum: ['admin-authored', 'creator-permitted', 'none'],
      default: 'none',
    },
    practiceTask: { type: String, default: '' },
    keyTakeaways: { type: [String], default: [] },
    requiresQuizToComplete: { type: Boolean, default: true },
    isPublished: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

lessonSchema.index({ pathId: 1, order: 1 });

export default mongoose.model('Lesson', lessonSchema);
