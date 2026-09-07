import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Plus, Edit3, Trash2, Search, X, CheckCircle2, Info,
  Target, ListChecks, HelpCircle, Filter, Eye, EyeOff, Save,
} from 'lucide-react';
import { interviewAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  PageHeader, LoadingScreen, EmptyState, Badge, MotionCard, Tabs,
  Spinner, Callout, SectionHeader, StatCard,
} from '../../components/ui/Primitives';
import Modal, { ConfirmModal } from '../../components/ui/Modal';

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const CATEGORIES = ['technical', 'project', 'hr', 'aptitude', 'exam'];
const CAT_LABEL = {
  technical: 'Technical', project: 'Project deep-dive', hr: 'HR & behavioural',
  aptitude: 'Aptitude', exam: 'Exam oriented',
};
const DIFF_TONE = { easy: 'mint', medium: 'amber', hard: 'coral' };

const empty = () => ({
  question: '', role: 'MERN Developer', topic: 'General', difficulty: 'medium',
  category: 'technical', idealAnswerOutline: [], mustMentionKeywords: [],
  followUps: [], isActive: true,
});

function LineList({ label, hint, items = [], onChange, placeholder }) {
  return (
    <div>
      <label className="label">{label} {hint && <span className="text-slate-600">{hint}</span>}</label>
      <textarea
        className="input min-h-[90px] resize-y font-mono text-[12px]"
        placeholder={placeholder}
        value={items.join('\n')}
        onChange={(e) => onChange(e.target.value.split('\n').filter((l) => l.trim()))}
      />
      <p className="text-[10.5px] text-slate-600 mt-1">{items.length} item(s)</p>
    </div>
  );
}

export default function AdminInterviewBank() {
  const toast = useToast();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [diffFilter, setDiffFilter] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(empty());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState('');

  const load = async () => {
    try {
      const d = await interviewAPI.listAll();
      setQuestions(d.questions || []);
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

  const openNew = () => { setForm(empty()); setEditingId(null); setEditorOpen(true); };
  const openEdit = (q) => { setForm({ ...empty(), ...q }); setEditingId(q._id); setEditorOpen(true); };

  const save = async () => {
    if (!form.question.trim()) return toast.error('The question text is required');
    setSaving(true);
    try {
      const payload = {
        question: form.question,
        role: form.role,
        topic: form.topic,
        difficulty: form.difficulty,
        category: form.category,
        idealAnswerOutline: form.idealAnswerOutline,
        mustMentionKeywords: form.mustMentionKeywords,
        followUps: form.followUps,
        isActive: form.isActive,
      };
      if (editingId) {
        await interviewAPI.update(editingId, payload);
        toast.success('Question updated');
      } else {
        await interviewAPI.create(payload);
        toast.success('Question added to the bank');
      }
      setEditorOpen(false);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (q) => {
    setBusy(q._id);
    try {
      await interviewAPI.update(q._id, { isActive: !q.isActive });
      toast.success(q.isActive ? 'Hidden from students' : 'Now visible to students');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    try {
      await interviewAPI.remove(deleting._id);
      toast.success('Question deleted');
      setDeleting(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) return <LoadingScreen label="Loading the interview bank…" />;

  const filtered = questions.filter((q) => {
    if (catFilter && q.category !== catFilter) return false;
    if (diffFilter && q.difficulty !== diffFilter) return false;
    if (!query) return true;
    const s = query.toLowerCase();
    return q.question.toLowerCase().includes(s) || q.topic?.toLowerCase().includes(s) || q.role?.toLowerCase().includes(s);
  });

  const active = questions.filter((q) => q.isActive);
  const withKeywords = questions.filter((q) => q.mustMentionKeywords?.length > 0);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <PageHeader
        icon={MessageSquare}
        title="Interview Question Bank"
        subtitle="The questions students practise against, plus the keywords the feedback engine scores their answers on."
        action={<button onClick={openNew} className="btn-primary"><Plus size={15} /> New question</button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={MessageSquare} label="Questions" value={questions.length} sub="In the bank" tone="violet" />
        <StatCard icon={Eye} label="Active" value={active.length} sub="Visible to students" tone="mint" delay={0.06} />
        <StatCard icon={Target} label="With keywords" value={withKeywords.length} sub="Scored on concept coverage" tone="cyan" delay={0.12} />
        <StatCard icon={ListChecks} label="Categories" value={new Set(questions.map((q) => q.category)).size} sub="Question types" tone="amber" delay={0.18} />
      </div>

      <Callout tone="violet" icon={Info} title="How keywords drive the score">
        The feedback engine checks whether a student's answer mentions each of your{' '}
        <strong>must-mention keywords</strong>. Coverage becomes the technical accuracy score out of 10, and anything
        missed is listed back to the student as "concepts you missed". Keywords are the single highest-leverage field
        here — a question with none falls back to a length heuristic.
      </Callout>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input className="input pl-10" placeholder="Search questions, topics, roles…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="input w-auto" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
        </select>
        <select className="input w-auto" value={diffFilter} onChange={(e) => setDiffFilter(e.target.value)} aria-label="Filter by difficulty">
          <option value="">Any difficulty</option>
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <MotionCard hover={false} className="p-8">
          <EmptyState
            icon={HelpCircle}
            title="No questions"
            description="Add the questions your students actually get asked in campus drives."
            action={<button onClick={openNew} className="btn-primary"><Plus size={15} /> New question</button>}
          />
        </MotionCard>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((q, i) => (
              <motion.div
                key={q._id}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ delay: Math.min(i * 0.025, 0.25) }}
                className={`glass p-4 ${!q.isActive ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      <Badge tone={DIFF_TONE[q.difficulty]}>{q.difficulty}</Badge>
                      <Badge tone="violet">{CAT_LABEL[q.category] || q.category}</Badge>
                      <Badge tone="slate">{q.role}</Badge>
                      <Badge tone="cyan">{q.topic}</Badge>
                      {!q.isActive && <Badge tone="coral">Hidden</Badge>}
                    </div>

                    <p className="text-[14px] font-semibold text-white leading-snug mb-2.5">{q.question}</p>

                    <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
                      <span>{q.idealAnswerOutline?.length || 0} outline point(s)</span>
                      <span>·</span>
                      <span className={q.mustMentionKeywords?.length ? 'text-emerald-400' : 'text-amber-400'}>
                        {q.mustMentionKeywords?.length || 0} scoring keyword(s)
                      </span>
                      <span>·</span>
                      <span>{q.followUps?.length || 0} follow-up(s)</span>
                    </div>

                    {q.mustMentionKeywords?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {q.mustMentionKeywords.slice(0, 6).map((k) => (
                          <span key={k} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-300 border border-emerald-400/20">
                            {k}
                          </span>
                        ))}
                        {q.mustMentionKeywords.length > 6 && (
                          <span className="text-[10px] text-slate-600 px-1">+{q.mustMentionKeywords.length - 6}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleActive(q)}
                      disabled={busy === q._id}
                      className="btn-secondary btn-sm"
                      title={q.isActive ? 'Hide from students' : 'Show to students'}
                    >
                      {busy === q._id ? <Spinner size={13} /> : q.isActive ? <Eye size={13} /> : <EyeOff size={13} />}
                      {q.isActive ? 'Active' : 'Hidden'}
                    </button>
                    <button onClick={() => openEdit(q)} className="btn-secondary btn-sm p-2" aria-label="Edit"><Edit3 size={13} /></button>
                    <button onClick={() => setDeleting(q)} className="btn-secondary btn-sm p-2 hover:text-rose-400" aria-label="Delete"><Trash2 size={13} /></button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* editor */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingId ? 'Edit question' : 'New interview question'}
        subtitle="Keywords are what the feedback engine scores against"
        icon={MessageSquare}
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? <><Spinner size={14} /> Saving…</> : <><Save size={15} /> {editingId ? 'Save changes' : 'Add question'}</>}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="qtext">Question *</label>
            <textarea
              id="qtext"
              className="input min-h-[90px] resize-y"
              placeholder="e.g. Explain the difference between authentication and authorisation, with an example from a project you built."
              value={form.question}
              onChange={(e) => set('question', e.target.value)}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3.5">
            <div>
              <label className="label" htmlFor="qrole">Role</label>
              <input id="qrole" className="input" placeholder="MERN Developer" value={form.role} onChange={(e) => set('role', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="qtopic">Topic</label>
              <input id="qtopic" className="input" placeholder="Authentication" value={form.topic} onChange={(e) => set('topic', e.target.value)} />
            </div>
            <div>
              <span className="label">Difficulty</span>
              <div className="grid grid-cols-3 gap-1.5">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    onClick={() => set('difficulty', d)}
                    className={`rounded-lg border px-2 py-2 text-[12px] font-medium capitalize transition-all ${
                      form.difficulty === d ? 'border-orbit-violet/60 bg-orbit-violet/12 text-white' : 'border-white/10 text-slate-400 hover:border-white/25'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="qcat">Category</label>
              <select id="qcat" className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
              </select>
            </div>
          </div>

          <LineList
            label="Must-mention keywords"
            hint="(one per line — these drive the technical accuracy score)"
            items={form.mustMentionKeywords}
            onChange={(v) => set('mustMentionKeywords', v)}
            placeholder={'JWT\nsession\nstateless\nmiddleware'}
          />

          <LineList
            label="Ideal answer outline"
            hint="(one point per line — shown to the student after they answer)"
            items={form.idealAnswerOutline}
            onChange={(v) => set('idealAnswerOutline', v)}
            placeholder={'Define both terms precisely\nExplain where each sits in the request lifecycle\nGive a concrete example from a real project'}
          />

          <LineList
            label="Likely follow-up questions"
            hint="(one per line)"
            items={form.followUps}
            onChange={(v) => set('followUps', v)}
            placeholder={'How would you handle token expiry?\nWhat happens if the refresh token leaks?'}
          />

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
              className="w-4 h-4 rounded accent-orbit-violet cursor-pointer"
            />
            <span className="text-[13px] text-slate-300">Active — students can practise this question</span>
          </label>
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete this question?"
        message="Past student attempts on it are kept, but nobody can practise it again. Consider hiding it instead."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
