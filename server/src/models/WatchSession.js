import mongoose from 'mongoose';

const watchSessionSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'PeerRoom', required: true, index: true },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    hostName: { type: String, default: '' },
    youtubeVideoId: { type: String, required: true },
    title: { type: String, default: 'Study session' },
    thumbnail: { type: String, default: '' },
    state: { type: String, enum: ['playing', 'paused', 'ended'], default: 'paused' },
    positionSeconds: { type: Number, default: 0 },
    // Wall-clock reference used to compute drift-corrected position for late joiners.
    lastSyncAt: { type: Date, default: Date.now },
    pinnedStudyPoints: [
      {
        timestamp: Number,
        label: String,
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        _id: false,
      },
    ],
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isActive: { type: Boolean, default: true },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/** Position corrected for elapsed wall-clock time while playing. */
watchSessionSchema.methods.currentPosition = function currentPosition() {
  if (this.state !== 'playing') return this.positionSeconds;
  const elapsed = (Date.now() - new Date(this.lastSyncAt).getTime()) / 1000;
  return this.positionSeconds + Math.max(0, elapsed);
};

export default mongoose.model('WatchSession', watchSessionSchema);
