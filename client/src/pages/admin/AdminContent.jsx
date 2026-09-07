import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Plus, Edit3, Trash2, Youtube, Search, Filter, Sparkles, X,
  CheckCircle2, AlertCircle, Info, FileText, Clock, ShieldCheck, Layers, Eye,
} from 'lucide-react';
import { lessonAPI, pathAPI, noteAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  PageHeader, LoadingScreen, EmptyState, Badge, MotionCard, Tabs,
  Spinner, Callout, SectionHeader, StatCard,
} from '../../components/ui/Primitives';
import Modal, { ConfirmModal } from '../../components/ui/Modal';
import { extractYouTubeId, formatDuration, timeAgo } from '../../utils/helpers';

const emptyLesson = () => ({
  milestoneId: '', title: '', summary: '', topic: '', difficulty: 'beginner',
  estimatedMinutes: 30, order: 1, practiceTask: '', requiresQuizToComplete: true,
  authorizedTranscript: '', transcriptSource: 'none',
  primaryVideo: {
    youtubeVideoId: '', title: '', channelName: '', duration: 0, thumbnail: '',
    reasonForRecommendation: '', verifiedBy: 'CampusOrbit Placement Cell', isEmbeddable: true,
  },
});

export default function AdminContent() {
  const toast = useToast();
  const [lessons, setLessons] = useState([]);
  const [paths, setPaths] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [pathFilter, setPathFilter] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(emptyLesson());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [generating, setGenerating] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  const load = async () => {
    try {
      const [l, p] = await Promise.all([lessonAPI.listAll(), pathAPI.list()]);
      setLessons(l.lessons || []);
      setPaths(p.paths || []);
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

  /** Load milestones for the chosen path so the lesson can be attached. */
  const loadMilestones = async (pathId) => {
    if (!pathId) return setMilestones([]);
    try {
      const d = await pathAPI.get(pathId);
      setMilestones(d.milestones || []);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const openNew = async () => {
    setForm(emptyLesson());
    setVideoUrl('');
    setEditingId(null);
    setEditorOpen(true);
    if (paths[0]) await loadMilestones(paths[0]._id);
  };

  const openEdit = async (l) => {
    setForm({
      ...emptyLesson(),
      ...l,
      milestoneId: l.milestoneId?._id || l.milestoneId,
      primaryVideo: { ...emptyLesson().primaryVideo, ...(l.primaryVideo || {}) },
    });
    setVideoUrl(l.primaryVideo?.youtubeVideoId ? `https://youtu.be/${l.primaryVideo.youtubeVideoId}` : '');
    setEditingId(l._id);
    setEditorOpen(true);
    await loadMilestones(l.pathId?._id || l.pathId);
  };

  const setPV = (k, v) => setForm((f) => ({ ...f, primaryVideo: { ...f.primaryVideo, [k]: v } }));

  const onVideoUrl = (v) => {
    setVideoUrl(v);
    const id = extractYouTubeId(v);
    if (id) setPV('youtubeVideoId', id);
  };

  const save = async () => {
    if (!form.title || !form.milestoneId || !form.primaryVideo.youtubeVideoId || !form.primaryVideo.title) {
      return toast.error('Title, milestone and the primary video (ID + title) are required');
    }
    setSaving(true);
    try {
      const payload = {
        milestoneId: form.milestoneId,
        title: form.title,
        summary: form.summary,
        topic: form.topic,
        difficulty: form.difficulty,
        estimatedMinutes: Number(form.estimatedMinutes) || 30,
        order: Number(form.order) || 1,
        practiceTask: form.practiceTask,
        requiresQuizToComplete: Boolean(form.requiresQuizToComplete),
        authorizedTranscript: form.authorizedTranscript,
        transcriptSource: form.authorizedTranscript ? (form.transcriptSource === 'none' ? 'admin-authored' : form.transcriptSource) : 'none',
        primaryVideo: {
          ...form.primaryVideo,
          duration: Number(form.primaryVideo.duration) || 0,
        },
      };
      if (editingId) {
        await lessonAPI.update(editingId, payload);
        toast.success('Lesson updated');
      } else {
        await lessonAPI.create(payload);
        toast.success('Lesson created with exactly one curated primary video');
      }
      setEditorOpen(false);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await lessonAPI.remove(deleting._id);
      toast.success('Lesson deleted');
      setDeleting(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const generate = async (lesson, publish) => {
    setGenerating(lesson._id);
    try {
      await noteAPI.generate(lesson._id, { publish });
      toast.success(
        publish
          ? 'Notes, flashcards and quiz generated and published to students.'
          : 'Generated as a draft. Review it in AI Review before publishing.'
      );
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGenerating('');
    }
  };

  if (loading) return <LoadingScreen label="Loading lessons…" />;

  const filtered = lessons.filter((l) => {
    if (pathFilter && String(l.pathId?._id || l.pathId) !== pathFilter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return l.title.toLowerCase().includes(q) || l.topic?.toLowerCase().includes(q) || l.primaryVideo?.channelName?.toLowerCase().includes(q);
  });

  const withTranscript = lessons.filter((l) => l.authorizedTranscript && l.transcriptSource !== 'none');

  return (
    <div className="space-y-5">
      <PageHeader
        icon={BookOpen}
        title="Content Manager"
        subtitle="Lessons, their single curated primary video, and the authorised transcripts that AI generation is allowed to use."
        action={<button onClick={openNew} className="btn-primary"><Plus size={15} /> New lesson</button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={BookOpen} label="Lessons" value={lessons.length} sub="Across all paths" tone="violet" />
        <StatCard icon={Layers} label="Paths" value={paths.length} sub="Learning tracks" tone="cyan" delay={0.06} />
        <StatCard icon={FileText} label="With transcript" value={withTranscript.length} sub="AI generation unlocked" tone="mint" delay={0.12} />
        <StatCard icon={AlertCircle} label="No transcript" value={lessons.length - withTranscript.length} sub="AI generation blocked" tone="amber" delay={0.18} />
      </div>

      <Callout tone="violet" icon={ShieldCheck} title="The transcript gate">
        AI note generation is <strong>hard-blocked</strong> on any lesson without an authorised transcript — the API
        returns a 400 with an explanation. CampusOrbit does not scrape YouTube captions. Paste a transcript you
        authored, or one the creator has explicitly permitted, and mark the source honestly.
      </Callout>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input className="input pl-10" placeholder="Search lessons, topics, channels…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="input w-auto min-w-[200px]" value={pathFilter} onChange={(e) => setPathFilter(e.target.value)} aria-label="Filter by path">
          <option value="">All paths</option>
          {paths.map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <MotionCard hover={false} className="p-8">
          <EmptyState
            icon={BookOpen}
            title="No lessons"
            description="Create a lesson and attach exactly one curated video to it."
            action={<button onClick={openNew} className="btn-primary"><Plus size={15} /> New lesson</button>}
          />
        </MotionCard>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((l, i) => {
              const hasTranscript = l.authorizedTranscript && l.transcriptSource !== 'none';
              return (
                <motion.div
                  key={l._id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: Math.min(i * 0.025, 0.25) }}
                  className="glass p-4"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <img
                        src={l.primaryVideo?.thumbnail || `https://i.ytimg.com/vi/${l.primaryVideo?.youtubeVideoId}/default.jpg`}
                        alt=""
                        className="w-24 aspect-video object-cover rounded-lg border border-white/10 shrink-0 bg-black"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.opacity = 0.15; }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-[14px] font-bold text-white">{l.title}</h3>
                          <Badge tone="slate">{l.difficulty}</Badge>
                          <Badge tone="cyan" icon={Clock}>{l.estimatedMinutes}m</Badge>
                          {hasTranscript ? (
                            <Badge tone="mint" icon={FileText}>Transcript: {l.transcriptSource}</Badge>
                          ) : (
                            <Badge tone="amber">No transcript</Badge>
                          )}
                          {l.requiresQuizToComplete && <Badge tone="violet">Quiz required</Badge>}
                        </div>
                        <p className="text-[12px] text-slate-400 line-clamp-1">{l.summary}</p>
                        <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                          <Youtube size={11} className="text-rose-400/70" />
                          {l.primaryVideo?.title} · {l.primaryVideo?.channelName}
                          {l.primaryVideo?.duration ? ` · ${formatDuration(l.primaryVideo.duration)}` : ''}
                        </p>
                        <p className="text-[10.5px] text-slate-600 mt-0.5">
                          {l.pathId?.title} → {l.milestoneId?.title} · order {l.order}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                      <button
                        onClick={() => generate(l, false)}
                        disabled={!hasTranscript || generating === l._id}
                        className="btn-secondary btn-sm"
                        title={hasTranscript ? 'Generate notes as a draft' : 'Add an authorised transcript first'}
                      >
                        {generating === l._id ? <Spinner size={13} /> : <Sparkles size={13} />} Generate draft
                      </button>
                      <button
                        onClick={() => generate(l, true)}
                        disabled={!hasTranscript || generating === l._id}
                        className="btn-success btn-sm"
                        title={hasTranscript ? 'Generate and publish immediately' : 'Add an authorised transcript first'}
                      >
                        <CheckCircle2 size={13} /> Generate & publish
                      </button>
                      <button onClick={() => openEdit(l)} className="btn-secondary btn-sm p-2" aria-label="Edit"><Edit3 size={13} /></button>
                      <button onClick={() => setDeleting(l)} className="btn-secondary btn-sm p-2 hover:text-rose-400" aria-label="Delete"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* -------------------------------------------------- lesson editor */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingId ? 'Edit lesson' : 'New lesson'}
        subtitle="Exactly one primary video per lesson — that constraint is the product."
        icon={BookOpen}
        size="xl"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? <><Spinner size={14} /> Saving…</> : <><CheckCircle2 size={15} /> {editingId ? 'Save changes' : 'Create lesson'}</>}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <SectionHeader icon={Layers} title="Placement" className="mb-3" />
            <div className="grid sm:grid-cols-2 gap-3.5">
              <div>
                <label className="label" htmlFor="lpath">Path</label>
                <select
                  id="lpath"
                  className="input"
                  onChange={(e) => { loadMilestones(e.target.value); setForm((f) => ({ ...f, milestoneId: '' })); }}
                  defaultValue={form.pathId?._id || form.pathId || (paths[0]?._id ?? '')}
                >
                  {paths.map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="lms">Milestone *</label>
                <select id="lms" className="input" value={form.milestoneId} onChange={(e) => setForm((f) => ({ ...f, milestoneId: e.target.value }))}>
                  <option value="">Select a milestone…</option>
                  {milestones.map((m) => <option key={m._id} value={m._id}>{m.order}. {m.title}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <SectionHeader icon={FileText} title="Lesson details" className="mb-3" />
            <div className="grid sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="ltitle">Title *</label>
                <input id="ltitle" className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="lsum">Summary</label>
                <textarea id="lsum" className="input min-h-[70px] resize-y" value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} />
              </div>
              <div>
                <label className="label" htmlFor="ltopic">Topic</label>
                <input id="ltopic" className="input" placeholder="e.g. React Hooks" value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))} />
              </div>
              <div>
                <label className="label" htmlFor="ldiff">Difficulty</label>
                <select id="ldiff" className="input" value={form.difficulty} onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}>
                  {['beginner', 'intermediate', 'advanced'].map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="lmin">Estimated minutes</label>
                <input id="lmin" className="input" type="number" min="1" max="600" value={form.estimatedMinutes} onChange={(e) => setForm((f) => ({ ...f, estimatedMinutes: e.target.value }))} />
              </div>
              <div>
                <label className="label" htmlFor="lorder">Order in milestone</label>
                <input id="lorder" className="input" type="number" min="1" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="lpractice">Practice task</label>
                <textarea id="lpractice" className="input min-h-[70px] resize-y" placeholder="What should the student build or solve after watching?" value={form.practiceTask} onChange={(e) => setForm((f) => ({ ...f, practiceTask: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requiresQuizToComplete}
                    onChange={(e) => setForm((f) => ({ ...f, requiresQuizToComplete: e.target.checked }))}
                    className="w-4 h-4 rounded accent-orbit-violet cursor-pointer"
                  />
                  <span className="text-[13px] text-slate-300">
                    Require passing the quiz before this lesson can be marked complete
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* primary video */}
          <div>
            <SectionHeader icon={Youtube} title="The one primary video" subtitle="Students see exactly this — no playlists, no alternatives" className="mb-3" />
            <div className="rounded-xl border border-rose-400/18 bg-rose-400/[0.035] p-4 space-y-3.5">
              <div>
                <label className="label" htmlFor="lvurl">YouTube URL or ID *</label>
                <input id="lvurl" className="input" placeholder="https://www.youtube.com/watch?v=…" value={videoUrl} onChange={(e) => onVideoUrl(e.target.value)} />
                {form.primaryVideo.youtubeVideoId && (
                  <p className="text-[11px] text-emerald-400 mt-1.5 flex items-center gap-1.5">
                    <CheckCircle2 size={11} /> Video ID: <code className="font-mono">{form.primaryVideo.youtubeVideoId}</code>
                  </p>
                )}
              </div>

              {form.primaryVideo.youtubeVideoId && (
                <img
                  src={`https://i.ytimg.com/vi/${form.primaryVideo.youtubeVideoId}/hqdefault.jpg`}
                  alt="Video thumbnail"
                  className="w-40 aspect-video object-cover rounded-lg border border-white/10 bg-black"
                />
              )}

              <div className="grid sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="lvtitle">Video title *</label>
                  <input id="lvtitle" className="input" value={form.primaryVideo.title} onChange={(e) => setPV('title', e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="lvchan">Channel name</label>
                  <input id="lvchan" className="input" value={form.primaryVideo.channelName} onChange={(e) => setPV('channelName', e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="lvdur">Duration (seconds)</label>
                  <input id="lvdur" className="input" type="number" min="0" value={form.primaryVideo.duration} onChange={(e) => setPV('duration', e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="lvreason">Why this video? <span className="text-slate-600">(shown to every student)</span></label>
                  <textarea
                    id="lvreason"
                    className="input min-h-[70px] resize-y"
                    placeholder="Be specific: what does this explain better than the alternatives?"
                    value={form.primaryVideo.reasonForRecommendation}
                    onChange={(e) => setPV('reasonForRecommendation', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="lvverif">Verified by</label>
                  <input id="lvverif" className="input" value={form.primaryVideo.verifiedBy} onChange={(e) => setPV('verifiedBy', e.target.value)} />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.primaryVideo.isEmbeddable}
                      onChange={(e) => setPV('isEmbeddable', e.target.checked)}
                      className="w-4 h-4 rounded accent-orbit-violet cursor-pointer"
                    />
                    <span className="text-[13px] text-slate-300">Video allows embedding</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* transcript */}
          <div>
            <SectionHeader icon={ShieldCheck} title="Authorised transcript" subtitle="The only content AI generation may read" className="mb-3" />
            <div className="space-y-3.5">
              <div>
                <label className="label" htmlFor="ltsrc">Transcript source</label>
                <select id="ltsrc" className="input" value={form.transcriptSource} onChange={(e) => setForm((f) => ({ ...f, transcriptSource: e.target.value }))}>
                  <option value="none">None — AI generation stays blocked</option>
                  <option value="admin-authored">Admin authored (you wrote this summary yourself)</option>
                  <option value="creator-permitted">Creator permitted (you have explicit permission)</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="ltrans">
                  Transcript text <span className="text-slate-600">({(form.authorizedTranscript || '').length} characters)</span>
                </label>
                <textarea
                  id="ltrans"
                  className="input min-h-[160px] resize-y font-mono text-[12px]"
                  placeholder="Paste the authorised transcript or your own written walkthrough of the topic. This is what smart notes, flashcards and the quiz are generated from."
                  value={form.authorizedTranscript}
                  onChange={(e) => setForm((f) => ({ ...f, authorizedTranscript: e.target.value }))}
                />
              </div>
              <Callout tone="amber" icon={Info}>
                Leave this empty and the lesson still works perfectly — students get the curated video, practice task
                and their own notes. They just will not get generated smart notes, flashcards or a quiz.
              </Callout>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete this lesson?"
        message={`"${deleting?.title}" and its generated notes, flashcards and quiz will be removed. Student progress entries referencing it will be orphaned.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
