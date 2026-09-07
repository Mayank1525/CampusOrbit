import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    category: {
      type: String,
      enum: ['placement', 'exam', 'general', 'urgent'],
      default: 'general',
    },
    audience: {
      type: String,
      enum: ['all', 'students', 'seniors'],
      default: 'all',
    },
    pinned: { type: Boolean, default: false },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    publishedByName: { type: String, default: '' },
    expiresAt: { type: Date, default: null },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Announcement', announcementSchema);
