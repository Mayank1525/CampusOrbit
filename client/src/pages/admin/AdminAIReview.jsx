import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, CheckCircle2, Edit3, Eye, Send, X, AlertCircle, Info, Save,
  FileText, Languages, HelpCircle, Layers, ShieldCheck, RefreshCw, Trash2,
} from 'lucide-react';
import { noteAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import NoteViewer from '../../components/NoteViewer';
import {
  PageHeader, LoadingScreen, EmptyState, Badge, MotionCard, Tabs,
  Spinner, Callout, SectionHeader, StatCard,
} from '../../components/ui/Primitives';
import Modal, { ConfirmModal } from '../../components/ui/Modal';
import { timeAgo } from '../../utils/helpers';

export default function AdminAIReview() {
  const toast = useToast();
  const [notes, setNotes] = useState([]);
  const [aiStatus, setAiStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('draft');
  const [preview, setPreview] = useState(null);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState('');
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    try {
      const [d, a] = await Promise.all([
        noteAPI.review({ status: filter === 'all' ? undefined : filter }),
        noteAPI.aiStatus().catch(() => null),
      ]);
      setNotes(d.notes || []);
      setAiStatus(a?.ai || a);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const publish = async (n) => {
    setBusy(n._id);
    try {
      await noteAPI.publish(n._id);
      toast.success('Published — students can read this now.');
      load();
      if (preview?._id === n._id) setPreview(null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  const openEdit = (n) => {
    setEditing(n);
    setDraft(structuredClone(n));
  };

  const saveEdit = async () => {
    setBusy(editing._id);
    try {
      await noteAPI.update(editing._id, {
        title: draft.title,
        summary: draft.summary,
        keyConcepts: draft.keyConcepts,
        definitions: draft.definitions,
        practicalExamples: draft.practicalExamples,
        interviewQuestions: draft.interviewQuestions,
        beginnerExplanation: draft.beginnerExplanation,
        hinglishExplanation: draft.hinglishExplanation,
        revisionSummary: draft.revisionSummary,
      });
      toast.success('Edits saved. Publish when you are happy with it.');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    try {
      await noteAPI.remove(deleting._id);
      toast.success('Note deleted');
      setDeleting(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) return <LoadingScreen label="Loading the review queue…" />;

  const drafts = notes.filter((n) => n.status === 'draft');
  const published = notes.filter((n) => n.status === 'published');

  const setD = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Sparkles}
        title="AI Content Review"
        subtitle="Nothing generated reaches a student until a human reads it and clicks publish."
        badge={aiStatus && <Badge tone={aiStatus.mode === 'demo' ? 'amber' : 'violet'} icon={Sparkles}>{aiStatus.label}</Badge>}
        action={
          <>
            <button onClick={load} className="btn-secondary"><RefreshCw size={15} /> Refresh</button>
            <Tabs
              tabs={[
                { key: 'draft', label: 'Drafts', count: drafts.length },
                { key: 'published', label: 'Published' },
                { key: 'all', label: 'All' },
              ]}
              active={filter}
              onChange={setFilter}
            />
          </>
        }
      />

      {aiStatus?.mode === 'demo' && (
        <Callout tone="amber" icon={Info} title="You are reviewing Demo AI Mode output">
          {aiStatus.notice} The content below was produced by a deterministic rule engine that extracts key terms,
          builds definitions and drafts questions from the authorised transcript. Read it as a first draft written by
          a script, not by a language model — because that is exactly what it is.
        </Callout>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={AlertCircle} label="Awaiting review" value={drafts.length} sub="Hidden from students" tone={drafts.length ? 'coral' : 'mint'} />
        <StatCard icon={CheckCircle2} label="Published" value={published.length} sub="Live for students" tone="mint" delay={0.06} />
        <StatCard icon={FileText} label="In this view" value={notes.length} sub={`Filter: ${filter}`} tone="violet" delay={0.12} />
        <StatCard icon={ShieldCheck} label="Source" value="Transcript" sub="Authorised content only" tone="cyan" delay={0.18} />
      </div>

      <Callout tone="violet" icon={ShieldCheck} title="Why this gate exists">
        Generated study material that nobody checked is worse than no material — a student who memorises a wrong
        definition carries it into an interview. Drafts are invisible to students at the database query level, so the
        publish button is a genuine editorial decision, not a UI toggle.
      </Callout>

      {notes.length === 0 ? (
        <MotionCard hover={false} className="p-8">
          <EmptyState
            icon={Sparkles}
            title={filter === 'draft' ? 'Nothing waiting for review' : 'No generated notes'}
            description={
              filter === 'draft'
                ? 'Every generated note has been reviewed. Generate more from the Content Manager.'
                : 'Add an authorised transcript to a lesson, then generate notes from Content Manager.'
            }
          />
        </MotionCard>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {notes.map((n, i) => (
              <motion.div
                key={n._id}
                layout
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                whileHover={{ y: -4 }}
                className={`glass p-5 ${n.status === 'draft' ? 'border-amber-400/25' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <Badge tone={n.status === 'draft' ? 'amber' : 'mint'}>
                    {n.status === 'draft' ? 'Draft — hidden' : 'Published'}
                  </Badge>
                  <Badge tone={n.generationMode === 'demo' ? 'amber' : 'violet'} icon={Sparkles}>
                    {n.generationMode}
                  </Badge>
                </div>

                <h3 className="text-[14px] font-bold text-white leading-snug mb-1.5 line-clamp-2">{n.title}</h3>
                <p className="text-[11px] text-slate-500 mb-2.5">
                  Lesson: {n.lessonId?.title || 'unlinked'}
                </p>
                <p className="text-[12px] text-slate-400 leading-relaxed line-clamp-3 mb-3">{n.summary}</p>

                <div className="grid grid-cols-3 gap-1.5 mb-3.5">
                  {[
                    { l: 'Concepts', v: n.keyConcepts?.length || 0 },
                    { l: 'Defs', v: n.definitions?.length || 0 },
                    { l: 'Q&A', v: n.interviewQuestions?.length || 0 },
                  ].map((s) => (
                    <div key={s.l} className="rounded-lg bg-white/[0.045] px-2 py-1.5 text-center">
                      <p className="text-[13px] font-bold text-slate-200 tabular-nums">{s.v}</p>
                      <p className="text-[8.5px] uppercase tracking-wide text-slate-500">{s.l}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1 mb-3.5">
                  {n.hinglishExplanation && <Badge tone="pink" icon={Languages}>Hinglish</Badge>}
                  {n.beginnerExplanation && <Badge tone="cyan">Beginner</Badge>}
                  {n.generatedFrom === 'authorized-transcript' && <Badge tone="mint" icon={ShieldCheck}>Authorised</Badge>}
                </div>

                <p className="text-[10.5px] text-slate-600 mb-3">Generated {timeAgo(n.updatedAt || n.createdAt)}</p>

                <div className="flex gap-1.5">
                  <button onClick={() => setPreview(n)} className="btn-secondary btn-sm flex-1">
                    <Eye size={13} /> Preview
                  </button>
                  <button onClick={() => openEdit(n)} className="btn-secondary btn-sm p-2" aria-label="Edit"><Edit3 size={13} /></button>
                  {n.status === 'draft' ? (
                    <button onClick={() => publish(n)} disabled={busy === n._id} className="btn-success btn-sm">
                      {busy === n._id ? <Spinner size={13} /> : <Send size={13} />} Publish
                    </button>
                  ) : (
                    <button onClick={() => setDeleting(n)} className="btn-secondary btn-sm p-2 hover:text-rose-400" aria-label="Delete"><Trash2 size={13} /></button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* preview — exactly what a student sees */}
      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title="Student preview"
        subtitle="Rendered exactly as a learner would see it"
        icon={Eye}
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setPreview(null)}>Close</button>
            <button className="btn-secondary" onClick={() => { openEdit(preview); setPreview(null); }}>
              <Edit3 size={14} /> Edit
            </button>
            {preview?.status === 'draft' && (
              <button className="btn-success" onClick={() => publish(preview)} disabled={busy === preview?._id}>
                {busy === preview?._id ? <Spinner size={14} /> : <Send size={14} />} Publish to students
              </button>
            )}
          </>
        }
      >
        {preview && <NoteViewer note={preview} showActions={false} />}
      </Modal>

      {/* editor */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit generated content"
        subtitle={editing?.lessonId?.title}
        icon={Edit3}
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn-primary" onClick={saveEdit} disabled={busy === editing?._id}>
              {busy === editing?._id ? <Spinner size={14} /> : <Save size={14} />} Save edits
            </button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="ntitle">Title</label>
              <input id="ntitle" className="input" value={draft.title || ''} onChange={(e) => setD('title', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="nsum">Summary</label>
              <textarea id="nsum" className="input min-h-[90px] resize-y" value={draft.summary || ''} onChange={(e) => setD('summary', e.target.value)} />
            </div>

            <div>
              <label className="label">Key concepts <span className="text-slate-600">(one per line)</span></label>
              <textarea
                className="input min-h-[80px] resize-y font-mono text-[12px]"
                value={(draft.keyConcepts || []).join('\n')}
                onChange={(e) => setD('keyConcepts', e.target.value.split('\n').filter(Boolean))}
              />
            </div>

            <div>
              <label className="label">Definitions <span className="text-slate-600">(term :: meaning, one per line)</span></label>
              <textarea
                className="input min-h-[110px] resize-y font-mono text-[12px]"
                value={(draft.definitions || []).map((d) => `${d.term} :: ${d.meaning}`).join('\n')}
                onChange={(e) =>
                  setD('definitions', e.target.value.split('\n').filter(Boolean).map((line) => {
                    const [term, ...rest] = line.split('::');
                    return { term: (term || '').trim(), meaning: rest.join('::').trim() };
                  }))
                }
              />
            </div>

            <div>
              <label className="label">Practical examples <span className="text-slate-600">(one per line)</span></label>
              <textarea
                className="input min-h-[80px] resize-y font-mono text-[12px]"
                value={(draft.practicalExamples || []).join('\n')}
                onChange={(e) => setD('practicalExamples', e.target.value.split('\n').filter(Boolean))}
              />
            </div>

            <div>
              <label className="label">Interview questions <span className="text-slate-600">(one per line)</span></label>
              <textarea
                className="input min-h-[90px] resize-y font-mono text-[12px]"
                value={(draft.interviewQuestions || []).join('\n')}
                onChange={(e) => setD('interviewQuestions', e.target.value.split('\n').filter(Boolean))}
              />
            </div>

            <div>
              <label className="label" htmlFor="nbeg">Beginner explanation</label>
              <textarea id="nbeg" className="input min-h-[90px] resize-y" value={draft.beginnerExplanation || ''} onChange={(e) => setD('beginnerExplanation', e.target.value)} />
            </div>

            <div>
              <label className="label" htmlFor="nhin">Hinglish explanation</label>
              <textarea id="nhin" className="input min-h-[90px] resize-y" value={draft.hinglishExplanation || ''} onChange={(e) => setD('hinglishExplanation', e.target.value)} />
            </div>

            <div>
              <label className="label" htmlFor="nrev">60-second revision summary</label>
              <textarea id="nrev" className="input min-h-[80px] resize-y" value={draft.revisionSummary || ''} onChange={(e) => setD('revisionSummary', e.target.value)} />
            </div>

            <Callout tone="cyan" icon={Info}>
              Your edits overwrite the generated text in MongoDB. Regenerating this lesson from Content Manager will
              replace them — edit after generating, not before.
            </Callout>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete this note?"
        message="Students will lose access to it immediately. You can regenerate from the lesson transcript at any time."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
