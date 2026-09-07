import mongoose from 'mongoose';

const sectionSchema = new mongoose.Schema(
  {
    heading: { type: String, default: '' },
    timestamp: { type: Number, default: null },
    points: { type: [String], default: [] },
  },
  { _id: false }
);

const noteSchema = new mongoose.Schema(
  {
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    // ai = generated from authorized transcript; personal = written by the student
    kind: { type: String, enum: ['ai', 'personal'], default: 'ai' },
    title: { type: String, default: '' },
    summary: { type: String, default: '' },
    keyConcepts: { type: [String], default: [] },
    definitions: [
      {
        term: { type: String, default: '' },
        meaning: { type: String, default: '' },
        _id: false,
      },
    ],
    practicalExamples: { type: [String], default: [] },
    sections: { type: [sectionSchema], default: [] },
    interviewQuestions: { type: [String], default: [] },
    beginnerExplanation: { type: String, default: '' },
    hinglishExplanation: { type: String, default: '' },
    revisionSummary: { type: String, default: '' },
    body: { type: String, default: '' }, // personal notes free text
    highlights: { type: [String], default: [] },
    bookmarked: { type: Boolean, default: false },
    markedForRevision: { type: Boolean, default: false },
    generationMode: { type: String, enum: ['demo', 'live-ai', 'human'], default: 'demo' },
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
    generatedFrom: { type: String, enum: ['authorized-transcript', 'student-content', 'manual'], default: 'manual' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export default mongoose.model('Note', noteSchema);
