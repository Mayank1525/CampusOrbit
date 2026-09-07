import mongoose from 'mongoose';

const peerRoomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    description: { type: String, default: '' },
    topic: { type: String, default: '' },
    category: {
      type: String,
      enum: ['path', 'dsa', 'exam', 'aptitude', 'general'],
      default: 'general',
    },
    accentColor: { type: String, default: '#7c5cff' },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    pinnedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
    resourceLinks: [
      { label: String, url: String, addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, _id: false },
    ],
    activeWatchSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WatchSession', default: null },
    isApproved: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

peerRoomSchema.virtual('memberCount').get(function memberCount() {
  return (this.members || []).length;
});

export default mongoose.model('PeerRoom', peerRoomSchema);
