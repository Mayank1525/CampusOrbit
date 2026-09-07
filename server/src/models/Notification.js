import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'opportunity-match',
        'deadline',
        'revision-due',
        'quiz-pending',
        'room-reply',
        'new-resource',
        'profile-incomplete',
        'application-status',
        'announcement',
        'system',
      ],
      default: 'system',
      index: true,
    },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: { type: String, default: '' },
    icon: { type: String, default: 'bell' },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    read: { type: Boolean, default: false, index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    dedupeKey: { type: String, default: '', index: true },
  },
  { timestamps: true }
);

export default mongoose.model('Notification', notificationSchema);
