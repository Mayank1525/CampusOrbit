import mongoose from 'mongoose';

const flashcardSchema = new mongoose.Schema(
  {
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', index: true },
    noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    front: { type: String, required: true },
    back: { type: String, required: true },
    topic: { type: String, default: '' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    generationMode: { type: String, enum: ['demo', 'live-ai', 'human'], default: 'demo' },
  },
  { timestamps: true }
);

export default mongoose.model('Flashcard', flashcardSchema);
