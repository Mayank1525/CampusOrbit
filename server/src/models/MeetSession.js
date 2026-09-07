import mongoose from 'mongoose';

/**
 * A live session hosted on Google Meet by an alumni/senior or the placement cell.
 *
 * CampusOrbit does NOT implement video calling (explicit project constraint) —
 * it schedules, announces and tracks attendance for a meeting that happens on
 * Google Meet. The host pastes their own Meet link; we validate the format,
 * never fabricate one, and never claim to host the call ourselves.
 */

const rsvpSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['going', 'maybe', 'not-going'], default: 'going' },
    respondedAt: { type: Date, default: Date.now },
    attended: { type: Boolean, default: false },
    joinedAt: { type: Date, default: null },
  },
  { _id: false }
);

const meetSessionSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'PeerRoom', required: true, index: true },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, default: '', maxlength: 2000 },
    topic: { type: String, default: '', trim: true, maxlength: 80 },

    // Free-form so a host can run anything: mock interview, resume review, AMA…
    sessionType: {
      type: String,
      enum: ['mock-interview', 'doubt-clearing', 'guest-talk', 'resume-review', 'group-study', 'other'],
      default: 'other',
      index: true,
    },

    meetLink: { type: String, required: true, trim: true },

    scheduledAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, default: 60, min: 5, max: 480 },

    maxSeats: { type: Number, default: 0 }, // 0 = unlimited
    rsvps: { type: [rsvpSchema], default: [] },

    status: {
      type: String,
      enum: ['scheduled', 'live', 'ended', 'cancelled'],
      default: 'scheduled',
      index: true,
    },

    // Host may add notes/recording links after the session.
    recapNotes: { type: String, default: '' },
    recordingLink: { type: String, default: '' },

    remindersSent: { type: [String], default: [] }, // dedupe keys: '24h', '1h', '10m'
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

meetSessionSchema.index({ roomId: 1, scheduledAt: -1 });
meetSessionSchema.index({ status: 1, scheduledAt: 1 });

/** When the meeting is expected to finish. */
meetSessionSchema.virtual('endsAt').get(function endsAt() {
  if (!this.scheduledAt) return null;
  return new Date(this.scheduledAt.getTime() + (this.durationMinutes || 60) * 60000);
});

meetSessionSchema.virtual('goingCount').get(function goingCount() {
  return (this.rsvps || []).filter((r) => r.status === 'going').length;
});

meetSessionSchema.virtual('seatsLeft').get(function seatsLeft() {
  if (!this.maxSeats) return null; // unlimited
  return Math.max(0, this.maxSeats - this.goingCount);
});

/**
 * Derived live state. Stored `status` wins for explicit host actions
 * (live / ended / cancelled); otherwise we compute from the clock so a session
 * shows as live even if the host never pressed "start".
 */
meetSessionSchema.virtual('computedStatus').get(function computedStatus() {
  if (this.status === 'cancelled' || this.status === 'ended') return this.status;
  const now = Date.now();
  const start = this.scheduledAt ? this.scheduledAt.getTime() : 0;
  const end = start + (this.durationMinutes || 60) * 60000;
  if (this.status === 'live') return now > end + 30 * 60000 ? 'ended' : 'live';
  // Doors open 10 minutes early.
  if (now >= start - 10 * 60000 && now <= end) return 'live';
  if (now > end) return 'ended';
  return 'scheduled';
});

export default mongoose.model('MeetSession', meetSessionSchema);
