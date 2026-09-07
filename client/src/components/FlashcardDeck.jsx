import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCw, ArrowLeft, ArrowRight, Layers, Shuffle, Check, X } from 'lucide-react';
import { Badge, ProgressBar } from './ui/Primitives';

/** 3D flip-card flashcard deck. */
export default function FlashcardDeck({ flashcards = [] }) {
  const [order, setOrder] = useState(() => flashcards.map((_, i) => i));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(new Set());

  if (!flashcards.length) {
    return (
      <div className="text-center py-10">
        <Layers size={26} className="text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-400">No flashcards for this lesson yet.</p>
      </div>
    );
  }

  const card = flashcards[order[index]];
  const go = (dir) => {
    setFlipped(false);
    setTimeout(() => setIndex((i) => (i + dir + order.length) % order.length), 120);
  };

  const shuffle = () => {
    const shuffled = [...order].sort(() => Math.random() - 0.5);
    setOrder(shuffled);
    setIndex(0);
    setFlipped(false);
  };

  const mark = (isKnown) => {
    setKnown((k) => {
      const next = new Set(k);
      if (isKnown) next.add(order[index]);
      else next.delete(order[index]);
      return next;
    });
    go(1);
  };

  const DIFF_TONE = { easy: 'mint', medium: 'amber', hard: 'coral' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-orbit-cyan" />
          <span className="text-[13px] font-semibold text-slate-200">
            Card {index + 1} of {order.length}
          </span>
          <Badge tone="mint">{known.size} known</Badge>
        </div>
        <button onClick={shuffle} className="btn-secondary btn-sm">
          <Shuffle size={13} /> Shuffle
        </button>
      </div>

      <ProgressBar value={((index + 1) / order.length) * 100} tone="cyan" height="h-1.5" />

      {/* flip card */}
      <div className="relative" style={{ perspective: 1400 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${order[index]}-${index}`}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.2 }}
          >
            <motion.button
              onClick={() => setFlipped((f) => !f)}
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 24 }}
              className="relative w-full min-h-[220px] rounded-2xl cursor-pointer text-left"
              style={{ transformStyle: 'preserve-3d' }}
              aria-label="Flip flashcard"
            >
              {/* front */}
              <div
                className="absolute inset-0 rounded-2xl border border-orbit-violet/25 bg-gradient-to-br from-orbit-violet/12 to-space-900/85 p-6 flex flex-col justify-center"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-orbit-violet">Question</span>
                  {card.difficulty && <Badge tone={DIFF_TONE[card.difficulty] || 'slate'}>{card.difficulty}</Badge>}
                </div>
                <p className="text-lg font-semibold text-white leading-snug">{card.front || card.question}</p>
                <p className="text-[11px] text-slate-500 mt-5 flex items-center gap-1.5">
                  <RotateCw size={11} /> Click to reveal the answer
                </p>
              </div>

              {/* back */}
              <div
                className="absolute inset-0 rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-400/12 to-space-900/85 p-6 flex flex-col justify-center"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-300 mb-4">Answer</span>
                <p className="text-[15px] text-slate-100 leading-relaxed">{card.back || card.answer}</p>
                {card.topic && <p className="text-[11px] text-slate-500 mt-4">Topic: {card.topic}</p>}
              </div>
            </motion.button>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button onClick={() => go(-1)} className="btn-secondary btn-sm">
          <ArrowLeft size={14} /> Previous
        </button>

        <div className="flex gap-2">
          <button onClick={() => mark(false)} className="btn-danger btn-sm">
            <X size={14} /> Still learning
          </button>
          <button onClick={() => mark(true)} className="btn-success btn-sm">
            <Check size={14} /> I know this
          </button>
        </div>

        <button onClick={() => go(1)} className="btn-secondary btn-sm">
          Next <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
