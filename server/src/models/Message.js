import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'PeerRoom', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, default: '' },
    authorRole: { type: String, default: 'student' },
    text: { type: String, required: true, maxlength: 2000 },
    type: {
      type: String,
      enum: ['text', 'resource', 'timestamp', 'system'],
      default: 'text',
    },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    videoTimestamp: { type: Number, default: null },
    watchSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WatchSession', default: null },
    reactions: [
      {
        emoji: { type: String, default: '👍' },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        _id: false,
      },
    ],
    isPinned: { type: Boolean, default: false },
    reports: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: String,
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ roomId: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);
