import mongoose from 'mongoose';

export const APPLICATION_STAGES = [
  'Saved',
  'Preparing',
  'Applied',
  'Shortlisted',
  'Assessment',
  'Technical Round',
  'HR Round',
  'Selected',
  'Rejected',
];

const timelineEntrySchema = new mongoose.Schema(
  {
    stage: { type: String, required: true },
    note: { type: String, default: '' },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Opportunity',
      required: true,
      index: true,
    },
    stage: { type: String, enum: APPLICATION_STAGES, default: 'Saved', index: true },
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', default: null },
    attachedLinks: {
      github: { type: String, default: '' },
      portfolio: { type: String, default: '' },
      projects: { type: [String], default: [] },
    },
    coverNote: { type: String, default: '' },
    eligibilitySnapshot: {
      eligible: { type: Boolean, default: false },
      reasons: { type: [String], default: [] },
    },
    documentChecklist: [
      {
        label: String,
        satisfied: Boolean,
        _id: false,
      },
    ],
    timeline: { type: [timelineEntrySchema], default: [] },
    adminNotes: { type: String, default: '' },
    appliedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

applicationSchema.index({ userId: 1, opportunityId: 1 }, { unique: true });

export default mongoose.model('Application', applicationSchema);
