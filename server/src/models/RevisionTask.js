import mongoose from 'mongoose';

/** Spaced revision: 1 day -> 7 days -> 21 days. */
export const REVISION_INTERVALS = [1, 7, 21];

const revisionTaskSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', default: null },
    noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', default: null },
    topic: { type: String, required: true },
    stage: { type: Number, default: 1 }, // 1 -> 1 day, 2 -> 7 days, 3 -> 21 days
    dueDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'completed', 'skipped'],
      default: 'pending',
    },
    completedAt: { type: Date, default: null },
    rescheduledCount: { type: Number, default: 0 },
    notifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('RevisionTask', revisionTaskSchema);
