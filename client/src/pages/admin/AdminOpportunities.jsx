import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, Plus, Edit3, Trash2, Send, Archive, Search, Filter, Users,
  Calendar, X, CheckCircle2, AlertCircle, Eye, Info, Copy, ListChecks, Layers,
} from 'lucide-react';
import { opportunityAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  PageHeader, LoadingScreen, EmptyState, Badge, MotionCard, Tabs,
  Spinner, Callout, SectionHeader, StatCard,
} from '../../components/ui/Primitives';
import Modal, { ConfirmModal } from '../../components/ui/Modal';
import { formatDate, deadlineLabel } from '../../utils/helpers';

const TYPES = ['placement', 'internship', 'hackathon', 'scholarship', 'exam'];
const MODES = ['onsite', 'remote', 'hybrid'];
const BRANCHES = ['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Chemical', 'AIML', 'Data Science'];
const DOC_OPTIONS = ['Resume', 'Marksheet', 'Transcript', 'Photograph', 'Government ID', 'GitHub profile', 'Portfolio', 'Coding profile', 'Project links', 'Certificates'];

const emptyForm = () => ({
  title: '', company: '', companyLogoText: '', type: 'placement', role: '',
  location: '', workMode: 'onsite', description: '', responsibilities: [],
  skillsRequired: [], stipendOrCtc: '', deadline: '', driveDate: '',
  eligibility: { minCgpa: 0, allowedBranches: [], allowedGraduationYears: [], maxBacklogs: 99 },
  requiredDocuments: ['Resume'], rounds: [], officialLink: '', status: 'draft',
  seatsAvailable: 0, tags: [],
});

function ChipList({ items = [], onChange, placeholder, suggestions = [] }) {
  const [draft, setDraft] = useState('');
  const add = (v) => {
    const val = (v ?? draft).trim();
    if (!val || items.includes(val)) return;
    onChange([...items, val]);
    setDraft('');
  };
  return (
    <div>
      <div className="flex gap-1.5 mb-2">
        <input
          className="input text-[13px] py-2 flex-1"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button onClick={() => add()} className="btn-secondary btn-sm px-3" aria-label="Add"><Plus size={13} /></button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span key={it} className="inline-flex items-center gap-1.5 chip-violet">
            {it}
            <button onClick={() => onChange(items.filter((x) => x !== it))} className="opacity-60 hover:opacity-100" aria-label={`Remove ${it}`}>
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {suggestions.filter((s) => !items.includes(s)).slice(0, 8).map((s) => (
            <button key={s} onClick={() => add(s)} className="text-[10.5px] px-2 py-0.5 rounded-full border border-white/12 text-slate-500 hover:text-slate-200 hover:border-white/30 transition-all">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminOpportunities() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState('');
  const [eligibleFor, setEligibleFor] = useState(null);
  const [eligibleData, setEligibleData] = useState(null);

  const load = async () => {
    try {
      const params = { limit: 100 };
      if (statusFilter) params.status = statusFilter;
      const d = await opportunityAPI.list(params);
      setItems(d.opportunities || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const openNew = () => {
    setForm(emptyForm());
    setEditingId(null);
    setEditorOpen(true);
  };

  const openEdit = (o) => {
    setForm({
      ...emptyForm(),
      ...o,
      deadline: o.deadline ? new Date(o.deadline).toISOString().slice(0, 10) : '',
      driveDate: o.driveDate ? new Date(o.driveDate).toISOString().slice(0, 10) : '',
      eligibility: { ...emptyForm().eligibility, ...(o.eligibility || {}) },
    });
    setEditingId(o._id);
    setEditorOpen(true);
  };

  const duplicate = (o) => {
    setForm({
      ...emptyForm(),
      ...o,
      title: `${o.title} (copy)`,
      status: 'draft',
      deadline: o.deadline ? new Date(o.deadline).toISOString().slice(0, 10) : '',
      driveDate: o.driveDate ? new Date(o.driveDate).toISOString().slice(0, 10) : '',
      eligibility: { ...emptyForm().eligibility, ...(o.eligibility || {}) },
    });
    setEditingId(null);
    setEditorOpen(true);
  };

  const save = async () => {
    if (!form.title || !form.company || !form.deadline) {
      return toast.error('Title, company and deadline are required');
    }
    setSaving(true);
    try {
      const { _id, __v, createdAt, updatedAt, id, isExpired, postedBy, eligibilityResult, match, bookmarked, application, ...rest } = form;
      const payload = {
        ...rest,
        deadline: new Date(form.deadline).toISOString(),
        driveDate: form.driveDate ? new Date(form.driveDate).toISOString() : null,
        seatsAvailable: Number(form.seatsAvailable) || 0,
        eligibility: {
          minCgpa: Number(form.eligibility.minCgpa) || 0,
          allowedBranches: form.eligibility.allowedBranches || [],
          allowedGraduationYears: (form.eligibility.allowedGraduationYears || []).map(Number),
          maxBacklogs: Number(form.eligibility.maxBacklogs ?? 99),
        },
      };
      if (editingId) {
        await opportunityAPI.update(editingId, payload);
        toast.success('Opportunity updated');
      } else {
        await opportunityAPI.create(payload);
        toast.success(`Created as ${payload.status}. ${payload.status === 'draft' ? 'Students cannot see it until you publish.' : 'It is live for students now.'}`);
      }
      setEditorOpen(false);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const publish = async (o) => {
    setBusy(o._id);
    try {
      await opportunityAPI.publish(o._id);
      toast.success(`"${o.title}" is now visible to every eligible student.`);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  const expire = async (o) => {
    setBusy(o._id);
    try {
      await opportunityAPI.expire(o._id);
      toast.success('Marked as expired');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    try {
      await opportunityAPI.remove(deleting._id);
      toast.success('Opportunity deleted');
      setDeleting(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const showEligible = async (o) => {
    setEligibleFor(o);
    setEligibleData(null);
    try {
      setEligibleData(await opportunityAPI.eligibleStudents(o._id));
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) return <LoadingScreen label="Loading opportunities…" />;

  const filtered = items.filter(
    (o) => !query || o.title.toLowerCase().includes(query.toLowerCase()) || o.company.toLowerCase().includes(query.toLowerCase())
  );

  const drafts = items.filter((o) => o.status === 'draft');
  const published = items.filter((o) => o.status === 'published');
  const expired = items.filter((o) => o.status === 'expired' || o.status === 'closed');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setEl = (k, v) => setForm((f) => ({ ...f, eligibility: { ...f.eligibility, [k]: v } }));

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Briefcase}
        title="Manage Opportunities"
        subtitle="Create drives, define explainable eligibility rules, and publish when they are ready."
        action={<button onClick={openNew} className="btn-primary"><Plus size={15} /> New opportunity</button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Briefcase} label="Total" value={items.length} sub="All statuses" tone="violet" />
        <StatCard icon={CheckCircle2} label="Published" value={published.length} sub="Live for students" tone="mint" delay={0.06} />
        <StatCard icon={Edit3} label="Drafts" value={drafts.length} sub="Hidden from students" tone="amber" delay={0.12} />
        <StatCard icon={Archive} label="Closed" value={expired.length} sub="Expired or closed" tone="slate" delay={0.18} />
      </div>

      {drafts.length > 0 && (
        <Callout tone="amber" icon={Info} title={`${drafts.length} draft${drafts.length === 1 ? '' : 's'} not yet visible to students`}>
          Drafts are filtered out of every student query at the API level — a student cannot reach one even by
          guessing the URL. Publish when the details are final.
        </Callout>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input className="input pl-10" placeholder="Search by title or company…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Tabs
          tabs={[
            { key: '', label: 'All', count: items.length },
            { key: 'published', label: 'Published', count: published.length },
            { key: 'draft', label: 'Drafts', count: drafts.length },
            { key: 'expired', label: 'Expired' },
          ]}
          active={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      {filtered.length === 0 ? (
        <MotionCard hover={false} className="p-8">
          <EmptyState
            icon={Briefcase}
            title="No opportunities"
            description="Create your first drive and students will see it the moment you publish."
            action={<button onClick={openNew} className="btn-primary"><Plus size={15} /> New opportunity</button>}
          />
        </MotionCard>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((o, i) => {
              const dl = deadlineLabel(o.deadline);
              return (
                <motion.div
                  key={o._id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: Math.min(i * 0.03, 0.25) }}
                  className="glass p-4"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orbit-violet/20 to-orbit-cyan/12 border border-white/10 flex items-center justify-center shrink-0 text-sm font-bold text-white">
                        {o.companyLogoText || o.company?.[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-[14.5px] font-bold text-white">{o.title}</h3>
                          <Badge tone={o.status === 'published' ? 'mint' : o.status === 'draft' ? 'amber' : 'slate'}>
                            {o.status}
                          </Badge>
                          <Badge tone="violet">{o.type}</Badge>
                          {o.status === 'published' && <Badge tone={dl.tone}>{dl.text}</Badge>}
                        </div>
                        <p className="text-[12px] text-slate-400">
                          {o.company} · {o.location || 'Remote'} · {o.stipendOrCtc || 'Stipend not stated'}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Closes {formatDate(o.deadline)}
                          {o.eligibility?.minCgpa > 0 && ` · min CGPA ${o.eligibility.minCgpa}`}
                          {o.eligibility?.allowedBranches?.length > 0 && ` · ${o.eligibility.allowedBranches.join('/')}`}
                          {o.eligibility?.maxBacklogs < 99 && ` · max ${o.eligibility.maxBacklogs} backlogs`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                      <button onClick={() => showEligible(o)} className="btn-secondary btn-sm" title="See who is eligible">
                        <Users size={13} /> Eligible
                      </button>
                      <Link to={`/admin/applicants?opportunityId=${o._id}`} className="btn-secondary btn-sm">
                        <ListChecks size={13} /> Applicants
                      </Link>
                      {o.status === 'draft' && (
                        <button onClick={() => publish(o)} disabled={busy === o._id} className="btn-success btn-sm">
                          {busy === o._id ? <Spinner size={13} /> : <Send size={13} />} Publish
                        </button>
                      )}
                      {o.status === 'published' && (
                        <button onClick={() => expire(o)} disabled={busy === o._id} className="btn-secondary btn-sm">
                          {busy === o._id ? <Spinner size={13} /> : <Archive size={13} />} Expire
                        </button>
                      )}
                      <button onClick={() => openEdit(o)} className="btn-secondary btn-sm p-2" aria-label="Edit"><Edit3 size={13} /></button>
                      <button onClick={() => duplicate(o)} className="btn-secondary btn-sm p-2" aria-label="Duplicate"><Copy size={13} /></button>
                      <button onClick={() => setDeleting(o)} className="btn-secondary btn-sm p-2 hover:text-rose-400" aria-label="Delete"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ------------------------------------------------- editor modal */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingId ? 'Edit opportunity' : 'New opportunity'}
        subtitle="Eligibility rules here are what students see explained on the drive page."
        icon={Briefcase}
        size="xl"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? <><Spinner size={14} /> Saving…</> : <><CheckCircle2 size={15} /> {editingId ? 'Save changes' : 'Create'}</>}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {/* basics */}
          <div>
            <SectionHeader icon={Briefcase} title="Basics" className="mb-3" />
            <div className="grid sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="otitle">Title *</label>
                <input id="otitle" className="input" placeholder="MERN Stack Developer Intern" value={form.title} onChange={(e) => set('title', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="ocompany">Company *</label>
                <input id="ocompany" className="input" value={form.company} onChange={(e) => set('company', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="ologo">Logo initials</label>
                <input id="ologo" className="input" placeholder="NX" maxLength={3} value={form.companyLogoText} onChange={(e) => set('companyLogoText', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="otype">Type</label>
                <select id="otype" className="input" value={form.type} onChange={(e) => set('type', e.target.value)}>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="orole">Role</label>
                <input id="orole" className="input" placeholder="Full-Stack Developer" value={form.role} onChange={(e) => set('role', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="oloc">Location</label>
                <input id="oloc" className="input" placeholder="Bengaluru" value={form.location} onChange={(e) => set('location', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="omode">Work mode</label>
                <select id="omode" className="input" value={form.workMode} onChange={(e) => set('workMode', e.target.value)}>
                  {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="octc">Stipend / CTC</label>
                <input id="octc" className="input" placeholder="₹25,000/month" value={form.stipendOrCtc} onChange={(e) => set('stipendOrCtc', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="oseats">Seats available</label>
                <input id="oseats" className="input" type="number" min="0" value={form.seatsAvailable} onChange={(e) => set('seatsAvailable', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="odl">Application deadline *</label>
                <input id="odl" className="input" type="date" value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="odd">Drive date</label>
                <input id="odd" className="input" type="date" value={form.driveDate} onChange={(e) => set('driveDate', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="odesc">Description</label>
                <textarea id="odesc" className="input min-h-[100px] resize-y" value={form.description} onChange={(e) => set('description', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="olink">Official link</label>
                <input id="olink" className="input" placeholder="https://…" value={form.officialLink} onChange={(e) => set('officialLink', e.target.value)} />
              </div>
            </div>
          </div>

          {/* eligibility */}
          <div>
            <SectionHeader icon={CheckCircle2} title="Eligibility rules" subtitle="Every rule is explained to students in plain English" className="mb-3" />
            <div className="rounded-xl border border-orbit-violet/22 bg-orbit-violet/[0.05] p-4 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="label" htmlFor="mincgpa">
                    Minimum CGPA — <span className="text-orbit-cyan">{form.eligibility.minCgpa || 'none'}</span>
                  </label>
                  <input
                    id="mincgpa" type="range" min="0" max="10" step="0.1"
                    value={form.eligibility.minCgpa}
                    onChange={(e) => setEl('minCgpa', e.target.value)}
                    className="w-full accent-orbit-violet cursor-pointer"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="maxbl">
                    Max backlogs — <span className="text-orbit-cyan">{form.eligibility.maxBacklogs >= 99 ? 'no limit' : form.eligibility.maxBacklogs}</span>
                  </label>
                  <input
                    id="maxbl" type="range" min="0" max="99"
                    value={form.eligibility.maxBacklogs}
                    onChange={(e) => setEl('maxBacklogs', e.target.value)}
                    className="w-full accent-orbit-cyan cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <span className="label">Allowed branches <span className="text-slate-600">(empty = all)</span></span>
                <div className="flex flex-wrap gap-1.5">
                  {BRANCHES.map((b) => {
                    const on = form.eligibility.allowedBranches?.includes(b);
                    return (
                      <button
                        key={b}
                        onClick={() => setEl('allowedBranches', on
                          ? form.eligibility.allowedBranches.filter((x) => x !== b)
                          : [...(form.eligibility.allowedBranches || []), b])}
                        className={`px-2.5 py-1 rounded-lg text-[12px] font-medium border transition-all ${
                          on ? 'border-orbit-violet/60 bg-orbit-violet/15 text-white' : 'border-white/10 text-slate-400 hover:border-white/25'
                        }`}
                      >
                        {b}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="label">Allowed graduation years <span className="text-slate-600">(empty = all)</span></span>
                <div className="flex flex-wrap gap-1.5">
                  {[2025, 2026, 2027, 2028, 2029].map((y) => {
                    const on = form.eligibility.allowedGraduationYears?.map(Number).includes(y);
                    return (
                      <button
                        key={y}
                        onClick={() => setEl('allowedGraduationYears', on
                          ? form.eligibility.allowedGraduationYears.filter((x) => Number(x) !== y)
                          : [...(form.eligibility.allowedGraduationYears || []), y])}
                        className={`px-3 py-1 rounded-lg text-[12px] font-medium border transition-all ${
                          on ? 'border-orbit-cyan/60 bg-cyan-400/15 text-white' : 'border-white/10 text-slate-400 hover:border-white/25'
                        }`}
                      >
                        {y}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* content lists */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <span className="label">Skills required</span>
              <ChipList
                items={form.skillsRequired}
                onChange={(v) => set('skillsRequired', v)}
                placeholder="Add a skill"
                suggestions={['JavaScript', 'React', 'Node.js', 'MongoDB', 'Express', 'DSA', 'SQL', 'Git']}
              />
            </div>
            <div>
              <span className="label">Tags</span>
              <ChipList items={form.tags} onChange={(v) => set('tags', v)} placeholder="Add a tag" suggestions={['mern', 'frontend', 'backend', 'dsa', 'fresher']} />
            </div>
            <div className="sm:col-span-2">
              <span className="label">Responsibilities</span>
              <ChipList items={form.responsibilities} onChange={(v) => set('responsibilities', v)} placeholder="Add a responsibility and press Enter" />
            </div>
            <div className="sm:col-span-2">
              <span className="label">Required documents <span className="text-slate-600">(drives the student checklist)</span></span>
              <ChipList items={form.requiredDocuments} onChange={(v) => set('requiredDocuments', v)} placeholder="Add a document" suggestions={DOC_OPTIONS} />
            </div>
          </div>

          {/* rounds */}
          <div>
            <SectionHeader icon={Layers} title="Selection rounds" className="mb-3" />
            <div className="space-y-2.5">
              {form.rounds.map((r, i) => (
                <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400">Round {i + 1}</span>
                    <button
                      onClick={() => set('rounds', form.rounds.filter((_, x) => x !== i))}
                      className="text-slate-500 hover:text-rose-400"
                      aria-label="Remove round"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <input
                    className="input text-[13px] py-2"
                    placeholder="Round name e.g. Online Assessment"
                    value={r.name}
                    onChange={(e) => set('rounds', form.rounds.map((x, xi) => (xi === i ? { ...x, name: e.target.value, order: i + 1 } : x)))}
                  />
                  <input
                    className="input text-[13px] py-2"
                    placeholder="What happens in this round"
                    value={r.description || ''}
                    onChange={(e) => set('rounds', form.rounds.map((x, xi) => (xi === i ? { ...x, description: e.target.value } : x)))}
                  />
                </div>
              ))}
              <button
                onClick={() => set('rounds', [...form.rounds, { name: '', description: '', order: form.rounds.length + 1 }])}
                className="btn-secondary btn-sm w-full"
              >
                <Plus size={13} /> Add round
              </button>
            </div>
          </div>

          {/* status */}
          <div>
            <span className="label">Status</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: 'draft', l: 'Save as draft', d: 'Hidden from students' },
                { v: 'published', l: 'Publish now', d: 'Live immediately' },
              ].map((s) => (
                <button
                  key={s.v}
                  onClick={() => set('status', s.v)}
                  className={`rounded-xl border px-3.5 py-3 text-left transition-all ${
                    form.status === s.v
                      ? 'border-orbit-violet/60 bg-orbit-violet/12'
                      : 'border-white/10 hover:border-white/25'
                  }`}
                >
                  <p className="text-[13px] font-semibold text-white">{s.l}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{s.d}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* eligible students modal */}
      <Modal
        open={Boolean(eligibleFor)}
        onClose={() => setEligibleFor(null)}
        title="Who is eligible?"
        subtitle={eligibleFor?.title}
        icon={Users}
        size="lg"
        footer={<button className="btn-primary" onClick={() => setEligibleFor(null)}>Close</button>}
      >
        {!eligibleData ? (
          <div className="flex justify-center py-10"><Spinner size={24} className="text-orbit-violet" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-4 py-3 text-center">
                <p className="text-2xl font-bold text-emerald-400 font-display">{eligibleData.eligible?.length ?? 0}</p>
                <p className="text-[11px] uppercase tracking-wider text-slate-400 mt-0.5">Eligible</p>
              </div>
              <div className="rounded-xl border border-rose-400/25 bg-rose-400/[0.06] px-4 py-3 text-center">
                <p className="text-2xl font-bold text-rose-400 font-display">{eligibleData.ineligible?.length ?? 0}</p>
                <p className="text-[11px] uppercase tracking-wider text-slate-400 mt-0.5">Not eligible</p>
              </div>
            </div>

            {eligibleData.eligible?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 mb-2">Eligible students</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin pr-1">
                  {eligibleData.eligible.map((s) => (
                    <div key={s._id} className="flex items-center gap-3 rounded-lg bg-emerald-400/[0.05] border border-emerald-400/15 px-3 py-2">
                      <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium text-slate-200 truncate">{s.fullName}</p>
                        <p className="text-[10.5px] text-slate-500">
                          {s.profile?.branch} · {s.profile?.cgpa} CGPA · {s.profile?.graduationYear}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {eligibleData.ineligible?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-300 mb-2">Not eligible — and why</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin pr-1">
                  {eligibleData.ineligible.map((s) => (
                    <div key={s._id} className="rounded-lg bg-rose-400/[0.05] border border-rose-400/15 px-3 py-2">
                      <p className="text-[12.5px] font-medium text-slate-200">{s.fullName}</p>
                      <p className="text-[10.5px] text-rose-200/70 leading-snug mt-0.5">
                        {(s.reasons || []).join(' ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete this opportunity?"
        message={`"${deleting?.title}" will be removed permanently. Existing applications to it will lose their linked drive.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
