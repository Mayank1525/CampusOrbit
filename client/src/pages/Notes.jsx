import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  NotebookPen, Repeat, Bookmark, Search, CalendarClock, CheckCircle2, Clock,
  AlertCircle, SkipForward, Plus, Trash2, Sparkles, BookOpen, ArrowRight, Info,
} from 'lucide-react';
import { noteAPI, revisionAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import NoteViewer from '../components/NoteViewer';
import {
  PageHeader, LoadingScreen, EmptyState, Badge, MotionCard, Tabs, Spinner, Callout, StatCard,
} from '../components/ui/Primitives';
import Modal, { ConfirmModal } from '../components/ui/Modal';
import { formatDate, timeAgo, daysUntil } from '../utils/helpers';

const REVISION_STAGE_LABEL = { 1: 'Day 1', 2: 'Day 7', 3: 'Day 21' };

export default function Notes() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') === 'revision' ? 'revision' : 'notes');
  const [notes, setNotes] = useState([]);
  const [revisions, setRevisions] = useState({ tasks: [], grouped: { overdue: [], today: [], upcoming: [] } });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [rescheduling, setRescheduling] = useState(null);
  const [rescheduleDays, setRescheduleDays] = useState(3);
  const [busy, setBusy] = useState('');

  const load = async () => {
    try {
      const [n, r] = await Promise.all([noteAPI.mine(), revisionAPI.list({ status: 'all' })]);
      setNotes(n.notes || []);
      setRevisions(r);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeTab = (t) => {
    setTab(t);
    setParams(t === 'revision' ? { tab: 'revision' } : {});
  };

  const completeRevision = async (task) => {
    setBusy(task._id);
    try {
      const res = await revisionAPI.complete(task._id);
      toast.success(res.message || 'Revision complete');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  const skipRevision = async (task) => {
    setBusy(task._id);
    try {
      await revisionAPI.skip(task._id);
      toast.info('Revision skipped — it will not count towards your streak.');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  const doReschedule = async () => {
    setBusy(rescheduling._id);
    try {
      await revisionAPI.reschedule(rescheduling._id, Number(rescheduleDays));
      toast.success(`Rescheduled for ${rescheduleDays} day(s) from now.`);
      setRescheduling(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  const removeNote = async () => {
    try {
      await noteAPI.remove(deleting._id);
      toast.success('Note deleted');
      setDeleting(null);
      if (selected?._id === deleting._id) setSelected(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) return <LoadingScreen label="Loading notes & revisions…" />;

  const filteredNotes = notes.filter((n) => {
    if (filter === 'bookmarked' && !n.bookmarked) return false;
    if (filter === 'ai' && n.kind !== 'ai') return false;
    if (filter === 'personal' && n.kind !== 'personal') return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      n.title?.toLowerCase().includes(q) ||
      n.summary?.toLowerCase().includes(q) ||
      n.body?.toLowerCase().includes(q) ||
      n.keyConcepts?.some((c) => c.toLowerCase().includes(q))
    );
  });

  const { overdue, today, upcoming } = revisions.grouped;
  const done = revisions.tasks.filter((t) => t.status === 'completed');

  const RevisionCard = ({ task, tone }) => {
    const d = daysUntil(task.dueDate);
    const toneMap = {
      overdue: { border: 'border-rose-400/28', bg: 'bg-rose-400/[0.06]', icon: AlertCircle, color: 'text-rose-300' },
      today: { border: 'border-amber-400/28', bg: 'bg-amber-400/[0.06]', icon: Clock, color: 'text-amber-300' },
      upcoming: { border: 'border-white/[0.08]', bg: 'bg-white/[0.025]', icon: CalendarClock, color: 'text-slate-400' },
      done: { border: 'border-emerald-400/22', bg: 'bg-emerald-400/[0.05]', icon: CheckCircle2, color: 'text-emerald-300' },
    }[tone];
    const Icon = toneMap.icon;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className={`rounded-xl border ${toneMap.border} ${toneMap.bg} p-4`}
      >
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-start gap-2.5 min-w-0">
            <Icon size={16} className={`${toneMap.color} shrink-0 mt-0.5`} />
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-slate-100 leading-snug">{task.topic}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {REVISION_STAGE_LABEL[task.stage] || `Stage ${task.stage}`} ·{' '}
                {tone === 'done'
                  ? `Completed ${timeAgo(task.completedAt)}`
                  : tone === 'overdue'
                  ? `Was due ${formatDate(task.dueDate)} (${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} ago)`
                  : tone === 'today'
                  ? 'Due today'
                  : `Due ${formatDate(task.dueDate)} (in ${d} day${d === 1 ? '' : 's'})`}
              </p>
            </div>
          </div>
          <Badge tone={tone === 'overdue' ? 'coral' : tone === 'today' ? 'amber' : tone === 'done' ? 'mint' : 'slate'}>
            {REVISION_STAGE_LABEL[task.stage] || `S${task.stage}`}
          </Badge>
        </div>

        {task.lessonId && (
          <Link
            to={`/learn/${task.lessonId._id || task.lessonId}`}
            className="text-[11px] text-orbit-cyan hover:underline inline-flex items-center gap-1 mb-3"
          >
            <BookOpen size={11} /> Open the lesson
          </Link>
        )}

        {tone !== 'done' && (
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => completeRevision(task)}
              disabled={busy === task._id}
              className="btn-success btn-sm flex-1"
            >
              {busy === task._id ? <Spinner size={12} /> : <CheckCircle2 size={13} />} Revised
            </button>
            <button onClick={() => { setRescheduling(task); setRescheduleDays(3); }} className="btn-secondary btn-sm">
              <CalendarClock size={13} /> Reschedule
            </button>
            <button
              onClick={() => skipRevision(task)}
              disabled={busy === task._id}
              className="btn-ghost btn-sm"
              title="Skip this revision"
            >
              <SkipForward size={13} />
            </button>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={NotebookPen}
        title="Notes & Revision"
        subtitle="Everything you have learned, plus the 1 / 7 / 21-day spaced revision schedule that keeps it there."
        action={
          <Tabs
            tabs={[
              { key: 'notes', label: 'Notes', icon: NotebookPen, count: notes.length },
              { key: 'revision', label: 'Revision', icon: Repeat, count: overdue.length + today.length },
            ]}
            active={tab}
            onChange={changeTab}
          />
        }
      />

      <AnimatePresence mode="wait">
        {tab === 'notes' ? (
          <motion.div
            key="notes"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  className="input pl-10"
                  placeholder="Search notes, concepts, definitions…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Tabs
                tabs={[
                  { key: 'all', label: 'All' },
                  { key: 'ai', label: 'Smart Notes' },
                  { key: 'personal', label: 'Mine' },
                  { key: 'bookmarked', label: 'Saved', icon: Bookmark },
                ]}
                active={filter}
                onChange={setFilter}
              />
            </div>

            {filteredNotes.length === 0 ? (
              <MotionCard hover={false} className="p-8">
                <EmptyState
                  icon={NotebookPen}
                  title={notes.length ? 'No notes match' : 'No notes yet'}
                  description={
                    notes.length
                      ? 'Try a different search or filter.'
                      : 'Open a lesson to read its smart notes, or write your own from the lesson page.'
                  }
                  action={!notes.length && <Link to="/learn" className="btn-primary"><BookOpen size={15} /> Go to lessons</Link>}
                />
              </MotionCard>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredNotes.map((n, i) => (
                  <motion.button
                    key={n._id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.3) }}
                    whileHover={{ y: -4 }}
                    onClick={() => setSelected(n)}
                    className="glass p-5 text-left group relative"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <Badge tone={n.kind === 'ai' ? 'violet' : 'cyan'} icon={n.kind === 'ai' ? Sparkles : NotebookPen}>
                        {n.kind === 'ai' ? (n.generationMode === 'demo' ? 'Demo AI' : 'Smart Note') : 'My note'}
                      </Badge>
                      <div className="flex gap-1.5">
                        {n.bookmarked && <Bookmark size={13} className="text-amber-400" fill="currentColor" />}
                        {n.markedForRevision && <Repeat size={13} className="text-orbit-cyan" />}
                      </div>
                    </div>

                    <h3 className="text-[14px] font-bold text-white leading-snug mb-1.5 line-clamp-2">
                      {n.title || 'Untitled note'}
                    </h3>
                    <p className="text-[12px] text-slate-400 leading-relaxed line-clamp-3 mb-3">
                      {n.summary || n.body || 'No summary'}
                    </p>

                    {n.keyConcepts?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {n.keyConcepts.slice(0, 3).map((c) => (
                          <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400 border border-white/10">
                            {c}
                          </span>
                        ))}
                        {n.keyConcepts.length > 3 && (
                          <span className="text-[10px] text-slate-600 px-1">+{n.keyConcepts.length - 3}</span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.06]">
                      <span className="text-[10px] text-slate-500">{timeAgo(n.updatedAt || n.createdAt)}</span>
                      <span className="text-[11px] text-orbit-cyan font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                        Read <ArrowRight size={11} />
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          /* ------------------------------------------------ revision tab */
          <motion.div
            key="revision"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-5"
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard icon={AlertCircle} label="Overdue" value={overdue.length} sub="Do these first" tone="coral" />
              <StatCard icon={Clock} label="Due today" value={today.length} sub="Today's revision" tone="amber" delay={0.06} />
              <StatCard icon={CalendarClock} label="Upcoming" value={upcoming.length} sub="Scheduled ahead" tone="cyan" delay={0.12} />
              <StatCard icon={CheckCircle2} label="Completed" value={done.length} sub="All time" tone="mint" delay={0.18} />
            </div>

            <Callout tone="violet" icon={Info} title="How spaced revision works here">
              Complete a lesson and CampusOrbit schedules a review for <strong>tomorrow</strong>. Mark that done and the
              next lands in <strong>7 days</strong>, then <strong>21 days</strong>. That schedule is what moves a topic
              from "I watched it" to "I can answer it in an interview". Life happens — use Reschedule instead of
              skipping.
            </Callout>

            {revisions.tasks.length === 0 ? (
              <MotionCard hover={false} className="p-8">
                <EmptyState
                  icon={Repeat}
                  title="No revision scheduled"
                  description="Finish a lesson and your first revision is scheduled automatically for tomorrow."
                  action={<Link to="/learn" className="btn-primary"><BookOpen size={15} /> Go to lessons</Link>}
                />
              </MotionCard>
            ) : (
              <div className="grid lg:grid-cols-3 gap-4">
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                    <AlertCircle size={12} /> Overdue ({overdue.length})
                  </p>
                  <AnimatePresence mode="popLayout">
                    {overdue.length === 0 ? (
                      <p className="text-xs text-slate-500 py-3">Nothing overdue. Well managed.</p>
                    ) : (
                      overdue.map((t) => <RevisionCard key={t._id} task={t} tone="overdue" />)
                    )}
                  </AnimatePresence>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Clock size={12} /> Due today ({today.length})
                  </p>
                  <AnimatePresence mode="popLayout">
                    {today.length === 0 ? (
                      <p className="text-xs text-slate-500 py-3">Nothing due today.</p>
                    ) : (
                      today.map((t) => <RevisionCard key={t._id} task={t} tone="today" />)
                    )}
                  </AnimatePresence>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <CalendarClock size={12} /> Upcoming ({upcoming.length})
                  </p>
                  <AnimatePresence mode="popLayout">
                    {upcoming.length === 0 ? (
                      <p className="text-xs text-slate-500 py-3">Nothing scheduled yet.</p>
                    ) : (
                      upcoming.slice(0, 8).map((t) => <RevisionCard key={t._id} task={t} tone="upcoming" />)
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {done.length > 0 && (
              <MotionCard hover={false} className="p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-3 flex items-center gap-1.5">
                  <CheckCircle2 size={12} /> Recently completed
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {done.slice(0, 6).map((t) => <RevisionCard key={t._id} task={t} tone="done" />)}
                </div>
              </MotionCard>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* note reader */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.title || 'Note'}
        icon={selected?.kind === 'ai' ? Sparkles : NotebookPen}
        size="lg"
        footer={
          <>
            {selected?.kind === 'personal' && (
              <button className="btn-danger" onClick={() => setDeleting(selected)}>
                <Trash2 size={14} /> Delete
              </button>
            )}
            <button className="btn-secondary" onClick={() => setSelected(null)}>Close</button>
          </>
        }
      >
        {selected && <NoteViewer note={selected} onChanged={load} />}
      </Modal>

      {/* reschedule */}
      <Modal
        open={Boolean(rescheduling)}
        onClose={() => setRescheduling(null)}
        title="Reschedule this revision"
        subtitle={rescheduling?.topic}
        icon={CalendarClock}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setRescheduling(null)}>Cancel</button>
            <button className="btn-primary" onClick={doReschedule} disabled={busy === rescheduling?._id}>
              {busy === rescheduling?._id ? <Spinner size={14} /> : <CalendarClock size={14} />} Reschedule
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400 leading-relaxed">
            Push this revision back without losing it. The stage stays the same, so the 1 / 7 / 21 chain continues.
          </p>
          <div>
            <label className="label" htmlFor="rdays">
              Remind me in <span className="text-orbit-cyan">{rescheduleDays} day{rescheduleDays === 1 ? '' : 's'}</span>
            </label>
            <input
              id="rdays"
              type="range" min="1" max="30"
              value={rescheduleDays}
              onChange={(e) => setRescheduleDays(e.target.value)}
              className="w-full accent-orbit-violet cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>1 day</span><span>15 days</span><span>30 days</span>
            </div>
          </div>
          <div className="flex gap-2">
            {[1, 3, 7, 14].map((d) => (
              <button
                key={d}
                onClick={() => setRescheduleDays(d)}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-[12px] font-semibold transition-all ${
                  Number(rescheduleDays) === d
                    ? 'border-orbit-violet/60 bg-orbit-violet/12 text-white'
                    : 'border-white/10 text-slate-400 hover:border-white/25'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={removeNote}
        title="Delete this note?"
        message="Your personal note will be permanently removed from MongoDB."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
