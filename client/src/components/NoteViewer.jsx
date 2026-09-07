import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, BookOpen, Languages, Lightbulb, HelpCircle, Bookmark, Repeat,
  ChevronDown, Highlighter, Baby, ListChecks, Quote, Info,
} from 'lucide-react';
import { noteAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Badge, Spinner, Callout } from './ui/Primitives';
import { formatDuration } from '../utils/helpers';

function Section({ title, icon: Icon, children, defaultOpen = true, tone = 'slate', count }) {
  const [open, setOpen] = useState(defaultOpen);
  const tones = {
    slate: 'text-slate-300',
    violet: 'text-orbit-violet',
    cyan: 'text-cyan-300',
    amber: 'text-amber-300',
    mint: 'text-emerald-300',
    pink: 'text-pink-300',
  };
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-white/[0.03] transition-colors"
        aria-expanded={open}
      >
        <Icon size={15} className={tones[tone]} />
        <span className="text-[13px] font-bold text-slate-100 flex-1 text-left">{title}</span>
        {count != null && <span className="text-[10px] text-slate-500 tabular-nums">{count}</span>}
        <ChevronDown size={15} className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function NoteViewer({ note, onChanged, showActions = true }) {
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const [simplified, setSimplified] = useState(null);
  const [local, setLocal] = useState(note);

  if (!note) return null;
  const n = local || note;

  const act = async (key, fn, message) => {
    setBusy(key);
    try {
      const res = await fn();
      if (res?.note) setLocal(res.note);
      if (message) toast.success(message);
      onChanged?.();
      return res;
    } catch (e) {
      toast.error(e.message);
      return null;
    } finally {
      setBusy('');
    }
  };

  const simplify = async () => {
    const res = await act('simplify', () => noteAPI.simplify(n._id));
    if (res) setSimplified(res);
  };

  return (
    <div className="space-y-3">
      {/* header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-base font-bold text-white font-display">{n.title || 'Smart Notes'}</h3>
            {n.kind === 'ai' && (
              <Badge tone={n.generationMode === 'demo' ? 'amber' : 'violet'} icon={Sparkles}>
                {n.generationMode === 'demo' ? 'Demo AI Mode' : n.generationMode === 'live-ai' ? 'AI generated' : 'Human authored'}
              </Badge>
            )}
            {n.status === 'draft' && <Badge tone="coral">Draft — not published</Badge>}
          </div>
          {n.generatedFrom === 'authorized-transcript' && (
            <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Info size={10} /> Generated from an admin-authorised transcript only.
            </p>
          )}
        </div>

        {showActions && (
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => act('bookmark', () => noteAPI.bookmark(n._id), n.bookmarked ? 'Bookmark removed' : 'Note bookmarked')}
              disabled={busy === 'bookmark'}
              className={`btn-sm ${n.bookmarked ? 'btn-primary' : 'btn-secondary'}`}
            >
              {busy === 'bookmark' ? <Spinner size={12} /> : <Bookmark size={13} fill={n.bookmarked ? 'currentColor' : 'none'} />}
              {n.bookmarked ? 'Saved' : 'Save'}
            </button>
            <button
              onClick={() => act('revision', () => noteAPI.markRevision(n._id), 'Revision scheduled — day 1, then 7, then 21')}
              disabled={busy === 'revision'}
              className={`btn-sm ${n.markedForRevision ? 'btn-primary' : 'btn-secondary'}`}
            >
              {busy === 'revision' ? <Spinner size={12} /> : <Repeat size={13} />}
              Revise
            </button>
            <button onClick={simplify} disabled={busy === 'simplify'} className="btn-secondary btn-sm">
              {busy === 'simplify' ? <Spinner size={12} /> : <Baby size={13} />}
              Explain simpler
            </button>
          </div>
        )}
      </div>

      {/* simplified overlay */}
      <AnimatePresence>
        {simplified && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Callout tone="cyan" icon={Baby} title={`Simpler explanation ${simplified.label ? `· ${simplified.label}` : ''}`}>
              <p className="whitespace-pre-line">{simplified.explanation || simplified.simplified || simplified.text}</p>
              <button onClick={() => setSimplified(null)} className="text-[11px] underline mt-2 opacity-70 hover:opacity-100">
                Hide
              </button>
            </Callout>
          </motion.div>
        )}
      </AnimatePresence>

      {/* summary */}
      {n.summary && (
        <div className="rounded-xl border border-orbit-violet/22 bg-orbit-violet/[0.06] px-4 py-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-orbit-violet mb-1.5 flex items-center gap-1.5">
            <Quote size={11} /> Summary
          </p>
          <p className="text-sm text-slate-200 leading-relaxed">{n.summary}</p>
        </div>
      )}

      {/* personal note body */}
      {n.kind === 'personal' && n.body && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{n.body}</p>
        </div>
      )}

      {/* key concepts */}
      {n.keyConcepts?.length > 0 && (
        <Section title="Key concepts" icon={ListChecks} tone="cyan" count={n.keyConcepts.length}>
          <div className="flex flex-wrap gap-1.5">
            {n.keyConcepts.map((c) => (
              <span key={c} className="chip-cyan">{c}</span>
            ))}
          </div>
        </Section>
      )}

      {/* definitions */}
      {n.definitions?.length > 0 && (
        <Section title="Definitions" icon={BookOpen} tone="violet" count={n.definitions.length}>
          <dl className="space-y-2.5">
            {n.definitions.map((d) => (
              <div key={d.term} className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3.5 py-2.5">
                <dt className="text-[13px] font-bold text-orbit-violet">{d.term}</dt>
                <dd className="text-[13px] text-slate-300 leading-relaxed mt-0.5">{d.meaning}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {/* structured sections */}
      {n.sections?.length > 0 && (
        <Section title="Detailed notes" icon={BookOpen} count={n.sections.length}>
          <div className="space-y-3.5">
            {n.sections.map((s, i) => (
              <div key={i}>
                <p className="text-[13px] font-bold text-slate-100 mb-1.5 flex items-center gap-2">
                  {s.heading}
                  {s.timestamp != null && (
                    <span className="text-[10px] text-orbit-cyan font-mono bg-cyan-400/10 border border-cyan-400/22 px-1.5 py-0.5 rounded">
                      {formatDuration(s.timestamp)}
                    </span>
                  )}
                </p>
                <ul className="space-y-1.5 ml-1">
                  {s.points.map((p, pi) => (
                    <li key={pi} className="text-[13px] text-slate-300 leading-relaxed flex gap-2">
                      <span className="text-orbit-violet mt-0.5 shrink-0">▸</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* practical examples */}
      {n.practicalExamples?.length > 0 && (
        <Section title="Practical examples" icon={Lightbulb} tone="amber" count={n.practicalExamples.length}>
          <ul className="space-y-2">
            {n.practicalExamples.map((e, i) => (
              <li key={i} className="text-[13px] text-slate-300 leading-relaxed rounded-lg bg-amber-400/[0.05] border border-amber-400/15 px-3.5 py-2.5">
                {e}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* beginner explanation */}
      {n.beginnerExplanation && (
        <Section title="Explain like I am new to this" icon={Baby} tone="mint" defaultOpen={false}>
          <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-line">{n.beginnerExplanation}</p>
        </Section>
      )}

      {/* Hinglish */}
      {n.hinglishExplanation && (
        <Section title="Hinglish mein samjho" icon={Languages} tone="pink" defaultOpen={false}>
          <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-line">{n.hinglishExplanation}</p>
        </Section>
      )}

      {/* interview questions */}
      {n.interviewQuestions?.length > 0 && (
        <Section title="Interview questions from this topic" icon={HelpCircle} tone="coral" count={n.interviewQuestions.length} defaultOpen={false}>
          <ol className="space-y-2">
            {n.interviewQuestions.map((q, i) => (
              <li key={i} className="text-[13px] text-slate-300 leading-relaxed flex gap-2.5">
                <span className="text-rose-400 font-bold shrink-0">{i + 1}.</span>
                {q}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* revision summary */}
      {n.revisionSummary && (
        <Section title="60-second revision" icon={Repeat} tone="cyan" defaultOpen={false}>
          <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-line">{n.revisionSummary}</p>
        </Section>
      )}

      {/* highlights */}
      {n.highlights?.length > 0 && (
        <Section title="Your highlights" icon={Highlighter} tone="amber" count={n.highlights.length} defaultOpen={false}>
          <ul className="space-y-1.5">
            {n.highlights.map((h, i) => (
              <li key={i} className="text-[13px] text-amber-100/85 leading-relaxed bg-amber-400/[0.07] border-l-2 border-amber-400/50 pl-3 py-1.5">
                {h}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
