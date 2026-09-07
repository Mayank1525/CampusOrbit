import mongoose from 'mongoose';

/**
 * "My Video Queue" - a student's personal YouTube resources.
 * The primary recommended video always remains the official path resource.
 */
const videoQueueItemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    youtubeVideoId: { type: String, required: true },
    originalUrl: { type: String, default: '' },
    title: { type: String, default: 'Personal resource' },
    channelName: { type: String, default: '' },
    thumbnail: { type: String, default: '' },
    relatedTopic: { type: String, default: '' },
    relatedLessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', default: null },
    personalNotes: { type: String, default: '' },
    lastTimestamp: { type: Number, default: 0 },
    watchedSeconds: { type: Number, default: 0 },
    percent: { type: Number, default: 0 },
    bookmarked: { type: Boolean, default: false },
    completed: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

videoQueueItemSchema.index({ userId: 1, youtubeVideoId: 1 }, { unique: true });

export default mongoose.model('VideoQueueItem', videoQueueItemSchema);
