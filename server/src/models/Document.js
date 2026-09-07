import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, required: true },
    category: {
      type: String,
      enum: [
        'resume',
        'marksheet',
        'certificate',
        'photo',
        'government-id',
        'project-link',
        'coding-profile',
        'other',
      ],
      default: 'other',
    },
    kind: { type: String, enum: ['file', 'link'], default: 'file' },
    fileName: { type: String, default: '' },
    storedName: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    sizeBytes: { type: Number, default: 0 },
    url: { type: String, default: '' },
    isPrivate: { type: Boolean, default: true },
    verified: { type: Boolean, default: false },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Document', documentSchema);
