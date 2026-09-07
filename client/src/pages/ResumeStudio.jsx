import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Plus, Download, Copy, Trash2, Star, Save, Palette, Layers,
  ChevronDown, ChevronUp, GripVertical, X, Eye, Sparkles, CheckCircle2,
  AlertCircle, Briefcase, GraduationCap, Code2, Award, User, Link2, Languages, Info, Loader2,
} from 'lucide-react';
import { resumeAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import ResumeRenderer, { TEMPLATE_META, A4 } from '../components/resume/ResumeTemplates';
import {
  PageHeader, LoadingScreen, EmptyState, Badge, MotionCard, ProgressRing,
  ProgressBar, Spinner, Callout, SectionHeader, Tabs,
} from '../components/ui/Primitives';
import Modal, { ConfirmModal } from '../components/ui/Modal';
import { timeAgo } from '../utils/helpers';

const ACCENTS = [
  { hex: '#7c5cff', name: 'Orbit Violet' },
  { hex: '#22d3ee', name: 'Cyan' },
  { hex: '#0f172a', name: 'Ink' },
  { hex: '#059669', name: 'Emerald' },
  { hex: '#dc2626', name: 'Crimson' },
  { hex: '#ea580c', name: 'Amber' },
  { hex: '#2563eb', name: 'Corporate Blue' },
  { hex: '#db2777', name: 'Magenta' },
];

/* ------------------------------------------------------------ collapsible */
function Panel({ title, icon: Icon, children, count, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-white/[0.035] transition-colors"
        aria-expanded={open}
      >
        <Icon size={15} className="text-orbit-violet" />
        <span className="text-[13px] font-bold text-slate-100 flex-1 text-left">{title}</span>
        {count != null && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.07] text-slate-400 tabular-nums">{count}</span>
        )}
        {open ? <ChevronUp size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
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
            <div className="px-4 pb-4 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, textarea, type = 'text' }) {
  return (
    <div>
      <label className="label text-[11px]">{label}</label>
      {textarea ? (
        <textarea
          className="input text-[13px] min-h-[80px] resize-y"
          placeholder={placeholder}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type={type}
          className="input text-[13px] py-2"
          placeholder={placeholder}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function ListEditor({ items = [], onChange, placeholder, label }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    if (!draft.trim()) return;
    onChange([...items, draft.trim()]);
    setDraft('');
  };
  return (
    <div>
      {label && <label className="label text-[11px]">{label}</label>}
      <div className="flex gap-1.5 mb-2">
        <input
          className="input text-[13px] py-2 flex-1"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button onClick={add} className="btn-secondary btn-sm px-3" aria-label="Add item"><Plus size={14} /></button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 chip-violet">
            {it}
            <button
              onClick={() => onChange(items.filter((_, x) => x !== i))}
              className="hover:text-white opacity-60 hover:opacity-100"
              aria-label={`Remove ${it}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        {items.length === 0 && <span className="text-[11px] text-slate-600">Nothing added yet.</span>}
      </div>
    </div>
  );
}

/* ================================================================= page */
export default function ResumeStudio() {
  const toast = useToast();
  const [resumes, setResumes] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [tab, setTab] = useState('content');
  const printRef = useRef(null);

  const load = async (selectId) => {
    try {
      const d = await resumeAPI.list();
      setResumes(d.resumes || []);
      const pick = selectId
        ? d.resumes.find((r) => String(r._id) === String(selectId))
        : d.resumes.find((r) => r.isDefault) || d.resumes[0];
      if (pick) {
        setActiveId(pick._id);
        setDraft(structuredClone(pick));
        setDirty(false);
      } else {
        setActiveId(null);
        setDraft(null);
      }
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

  const select = (r) => {
    if (dirty && !window.confirm('You have unsaved changes. Switch resume and discard them?')) return;
    setActiveId(r._id);
    setDraft(structuredClone(r));
    setDirty(false);
  };

  const patch = (updater) => {
    setDraft((d) => {
      const next = structuredClone(d);
      updater(next);
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const { _id, userId, createdAt, updatedAt, __v, id, completenessScore, ...payload } = draft;
      await resumeAPI.update(activeId, payload);
      toast.success('Resume saved to MongoDB');
      setDirty(false);
      load(activeId);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    try {
      const d = await resumeAPI.create({ name: `Resume ${resumes.length + 1}` });
      toast.success('Resume created and prefilled from your profile');
      load(d.resume._id);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const duplicate = async () => {
    try {
      const d = await resumeAPI.duplicate(activeId);
      toast.success('Duplicated — edit the copy freely');
      load(d.resume._id);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const makeDefault = async () => {
    try {
      await resumeAPI.setDefault(activeId);
      toast.success('Set as your default resume for applications');
      load(activeId);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const remove = async () => {
    try {
      await resumeAPI.remove(deleting._id);
      toast.success('Resume deleted');
      setDeleting(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  /** Real PDF export: html2canvas snapshot -> jsPDF A4, multipage aware. */
  const exportPDF = async () => {
    if (!printRef.current) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const node = printRef.current;
      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: A4.width,
      });

      const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      const img = canvas.toDataURL('image/jpeg', 0.94);

      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(img, 'JPEG', 0, position, pageW, imgH, undefined, 'FAST');
      heightLeft -= pageH;

      while (heightLeft > 4) {
        position -= pageH;
        pdf.addPage();
        pdf.addImage(img, 'JPEG', 0, position, pageW, imgH, undefined, 'FAST');
        heightLeft -= pageH;
      }

      const safe = (draft.personal?.fullName || draft.name || 'resume')
        .replace(/[^a-z0-9]+/gi, '_')
        .replace(/^_|_$/g, '');
      pdf.save(`${safe}_${draft.template}.pdf`);
      toast.success('PDF downloaded — open it and check it renders correctly.');
    } catch (e) {
      toast.error(`PDF export failed: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <LoadingScreen label="Opening Resume Studio…" />;

  if (!draft) {
    return (
      <div>
        <PageHeader icon={FileText} title="Resume Studio" subtitle="Four templates. One set of data. Real PDF export." />
        <MotionCard hover={false} className="p-8">
          <EmptyState
            icon={FileText}
            title="No resume yet"
            description="Create one and CampusOrbit prefills your name, college, branch, CGPA, skills and links from your profile. You only fill the interesting parts."
            action={<button onClick={create} className="btn-primary"><Plus size={15} /> Create my first resume</button>}
          />
        </MotionCard>
      </div>
    );
  }

  const completeness = draft.completenessScore ?? 0;
  const savedCompleteness = resumes.find((r) => String(r._id) === String(activeId))?.completenessScore ?? 0;
  const accent = draft.accentColor || '#7c5cff';

  const completenessChecks = [
    { label: 'Full name', ok: Boolean(draft.personal?.fullName) },
    { label: 'Email', ok: Boolean(draft.personal?.email) },
    { label: 'Phone', ok: Boolean(draft.personal?.phone) },
    { label: 'GitHub or LinkedIn', ok: Boolean(draft.personal?.github || draft.personal?.linkedin) },
    { label: 'Summary over 40 characters', ok: Boolean(draft.summary && draft.summary.length > 40) },
    { label: 'At least one education entry', ok: (draft.education || []).length > 0 },
    { label: 'At least one skill group', ok: (draft.skills || []).length > 0 },
    { label: 'Two or more projects', ok: (draft.projects || []).length >= 2 },
    { label: 'Experience or internship', ok: (draft.experience || []).length + (draft.internships || []).length > 0 },
    { label: 'Certificate or achievement', ok: (draft.certificates || []).length > 0 || (draft.achievements || []).length > 0 },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={FileText}
        title="Resume Studio"
        subtitle="Switch templates without losing a single word. Export a real PDF."
        badge={dirty ? <Badge tone="amber">Unsaved changes</Badge> : <Badge tone="mint">Saved</Badge>}
        action={
          <>
            <button onClick={create} className="btn-secondary"><Plus size={15} /> New</button>
            <button onClick={save} disabled={saving || !dirty} className="btn-primary">
              {saving ? <><Spinner size={14} /> Saving…</> : <><Save size={15} /> Save</>}
            </button>
          </>
        }
      />

      {/* resume switcher */}
      <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
        {resumes.map((r) => (
          <motion.button
            key={r._id}
            whileHover={{ y: -3 }}
            onClick={() => select(r)}
            className={`shrink-0 rounded-xl border px-4 py-3 text-left min-w-[190px] transition-all ${
              String(r._id) === String(activeId)
                ? 'border-orbit-violet/55 bg-orbit-violet/12'
                : 'border-white/[0.08] bg-white/[0.025] hover:border-white/22'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.accentColor }} />
              <p className="text-[13px] font-semibold text-slate-100 truncate flex-1">{r.name}</p>
              {r.isDefault && <Star size={12} className="text-amber-400 shrink-0" fill="currentColor" />}
            </div>
            <p className="text-[10.5px] text-slate-500">
              {TEMPLATE_META[r.template]?.name || r.template} · {r.completenessScore ?? 0}%
            </p>
            <ProgressBar value={r.completenessScore ?? 0} tone="violet" height="h-0.5" className="mt-1.5" />
          </motion.button>
        ))}
      </div>

      <div className="grid xl:grid-cols-[minmax(0,420px)_1fr] gap-5 items-start">
        {/* ------------------------------------------------ editor column */}
        <div className="space-y-4">
          {/* meta card */}
          <MotionCard hover={false} className="p-4">
            <div className="flex items-center gap-4 mb-4">
              <ProgressRing value={completeness} size={72} tone={completeness >= 80 ? 'mint' : 'amber'} sublabel="ready" />
              <div className="min-w-0 flex-1">
                <input
                  className="input text-[14px] font-semibold py-2 mb-2"
                  value={draft.name}
                  onChange={(e) => patch((d) => { d.name = e.target.value; })}
                  aria-label="Resume name"
                />
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={() => setTemplateOpen(true)} className="btn-secondary btn-sm">
                    <Layers size={13} /> {TEMPLATE_META[draft.template]?.name}
                  </button>
                  {!draft.isDefault && (
                    <button onClick={makeDefault} className="btn-secondary btn-sm">
                      <Star size={13} /> Default
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={duplicate} className="btn-secondary btn-sm">
                <Copy size={13} /> Duplicate
              </button>
              <button onClick={() => setPreviewOpen(true)} className="btn-secondary btn-sm xl:hidden">
                <Eye size={13} /> Preview
              </button>
              <button onClick={exportPDF} disabled={exporting} className="btn-primary btn-sm">
                {exporting ? <><Loader2 size={13} className="animate-spin" /> Exporting…</> : <><Download size={13} /> PDF</>}
              </button>
              <button
                onClick={() => setDeleting(resumes.find((r) => String(r._id) === String(activeId)))}
                disabled={resumes.length <= 1}
                className="btn-secondary btn-sm hover:text-rose-400"
                title={resumes.length <= 1 ? 'Keep at least one resume' : 'Delete this resume'}
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </MotionCard>

          <Tabs
            tabs={[
              { key: 'content', label: 'Content', icon: FileText },
              { key: 'design', label: 'Design', icon: Palette },
              { key: 'score', label: 'Score', icon: CheckCircle2 },
            ]}
            active={tab}
            onChange={setTab}
            className="w-full"
          />

          {tab === 'content' && (
            <div className="space-y-2.5">
              <Panel title="Personal details" icon={User} defaultOpen>
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Full name" value={draft.personal?.fullName} onChange={(v) => patch((d) => { d.personal.fullName = v; })} />
                  <Field label="Headline" value={draft.personal?.title} onChange={(v) => patch((d) => { d.personal.title = v; })} placeholder="Full-Stack Developer" />
                  <Field label="Email" value={draft.personal?.email} onChange={(v) => patch((d) => { d.personal.email = v; })} />
                  <Field label="Phone" value={draft.personal?.phone} onChange={(v) => patch((d) => { d.personal.phone = v; })} />
                  <Field label="Location" value={draft.personal?.location} onChange={(v) => patch((d) => { d.personal.location = v; })} placeholder="Lucknow, India" />
                  <Field label="GitHub" value={draft.personal?.github} onChange={(v) => patch((d) => { d.personal.github = v; })} />
                  <Field label="LinkedIn" value={draft.personal?.linkedin} onChange={(v) => patch((d) => { d.personal.linkedin = v; })} />
                  <Field label="Portfolio" value={draft.personal?.portfolio} onChange={(v) => patch((d) => { d.personal.portfolio = v; })} />
                </div>
              </Panel>

              <Panel title="Summary" icon={Sparkles} defaultOpen>
                <Field
                  textarea
                  label="Professional summary"
                  value={draft.summary}
                  onChange={(v) => patch((d) => { d.summary = v; })}
                  placeholder="Two or three lines. What you build, what you know, what you are looking for. Concrete beats generic."
                />
                <p className="text-[10.5px] text-slate-500">
                  {(draft.summary || '').length} characters — aim for 150 to 400.
                </p>
              </Panel>

              <Panel title="Education" icon={GraduationCap} count={draft.education?.length || 0} defaultOpen>
                {(draft.education || []).map((ed, i) => (
                  <div key={i} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400">Entry {i + 1}</span>
                      <button onClick={() => patch((d) => { d.education.splice(i, 1); })} className="text-slate-500 hover:text-rose-400" aria-label="Remove education">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <Field label="Institution" value={ed.institution} onChange={(v) => patch((d) => { d.education[i].institution = v; })} />
                      <Field label="Degree" value={ed.degree} onChange={(v) => patch((d) => { d.education[i].degree = v; })} placeholder="B.Tech" />
                      <Field label="Field" value={ed.field} onChange={(v) => patch((d) => { d.education[i].field = v; })} placeholder="Computer Science" />
                      <Field label="Score" value={ed.score} onChange={(v) => patch((d) => { d.education[i].score = v; })} placeholder="8.2 CGPA" />
                      <Field label="Start year" value={ed.startYear} onChange={(v) => patch((d) => { d.education[i].startYear = v; })} placeholder="2022" />
                      <Field label="End year" value={ed.endYear} onChange={(v) => patch((d) => { d.education[i].endYear = v; })} placeholder="2026" />
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => patch((d) => { d.education = [...(d.education || []), { institution: '', degree: '', field: '', startYear: '', endYear: '', score: '' }]; })}
                  className="btn-secondary btn-sm w-full"
                >
                  <Plus size={13} /> Add education
                </button>
              </Panel>

              <Panel title="Skills" icon={Code2} count={draft.skills?.length || 0}>
                {(draft.skills || []).map((g, i) => (
                  <div key={i} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        className="input text-[13px] py-1.5 flex-1"
                        placeholder="Category e.g. Languages"
                        value={g.category || ''}
                        onChange={(e) => patch((d) => { d.skills[i].category = e.target.value; })}
                      />
                      <button onClick={() => patch((d) => { d.skills.splice(i, 1); })} className="text-slate-500 hover:text-rose-400" aria-label="Remove group">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <ListEditor
                      items={g.items || []}
                      onChange={(items) => patch((d) => { d.skills[i].items = items; })}
                      placeholder="Add a skill and press Enter"
                    />
                  </div>
                ))}
                <button
                  onClick={() => patch((d) => { d.skills = [...(d.skills || []), { category: '', items: [] }]; })}
                  className="btn-secondary btn-sm w-full"
                >
                  <Plus size={13} /> Add skill group
                </button>
              </Panel>

              <Panel title="Projects" icon={Layers} count={draft.projects?.length || 0}>
                {(draft.projects || []).map((pr, i) => (
                  <div key={i} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400">Project {i + 1}</span>
                      <button onClick={() => patch((d) => { d.projects.splice(i, 1); })} className="text-slate-500 hover:text-rose-400" aria-label="Remove project">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <Field label="Name" value={pr.name} onChange={(v) => patch((d) => { d.projects[i].name = v; })} />
                    <Field textarea label="Description" value={pr.description} onChange={(v) => patch((d) => { d.projects[i].description = v; })} placeholder="What it does and who it is for." />
                    <ListEditor label="Tech stack" items={pr.techStack || []} onChange={(v) => patch((d) => { d.projects[i].techStack = v; })} placeholder="React, Node, MongoDB…" />
                    <ListEditor label="Highlights" items={pr.highlights || []} onChange={(v) => patch((d) => { d.projects[i].highlights = v; })} placeholder="Impact statement with a number" />
                    <div className="grid grid-cols-2 gap-2.5">
                      <Field label="Repo URL" value={pr.repoUrl} onChange={(v) => patch((d) => { d.projects[i].repoUrl = v; })} />
                      <Field label="Live URL" value={pr.liveUrl} onChange={(v) => patch((d) => { d.projects[i].liveUrl = v; })} />
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => patch((d) => { d.projects = [...(d.projects || []), { name: '', description: '', techStack: [], highlights: [], repoUrl: '', liveUrl: '' }]; })}
                  className="btn-secondary btn-sm w-full"
                >
                  <Plus size={13} /> Add project
                </button>
              </Panel>

              <Panel title="Experience & internships" icon={Briefcase} count={(draft.experience?.length || 0) + (draft.internships?.length || 0)}>
                {(draft.experience || []).map((e, i) => (
                  <div key={i} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400">Experience {i + 1}</span>
                      <button onClick={() => patch((d) => { d.experience.splice(i, 1); })} className="text-slate-500 hover:text-rose-400" aria-label="Remove">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <Field label="Company" value={e.company} onChange={(v) => patch((d) => { d.experience[i].company = v; })} />
                      <Field label="Role" value={e.role} onChange={(v) => patch((d) => { d.experience[i].role = v; })} />
                      <Field label="Start" value={e.startDate} onChange={(v) => patch((d) => { d.experience[i].startDate = v; })} placeholder="Jun 2025" />
                      <Field label="End" value={e.endDate} onChange={(v) => patch((d) => { d.experience[i].endDate = v; })} placeholder="Present" />
                    </div>
                    <Field textarea label="Description" value={e.description} onChange={(v) => patch((d) => { d.experience[i].description = v; })} />
                    <ListEditor label="Highlights" items={e.highlights || []} onChange={(v) => patch((d) => { d.experience[i].highlights = v; })} placeholder="Shipped X, reduced Y by Z%" />
                  </div>
                ))}
                <button
                  onClick={() => patch((d) => { d.experience = [...(d.experience || []), { company: '', role: '', startDate: '', endDate: '', description: '', highlights: [] }]; })}
                  className="btn-secondary btn-sm w-full"
                >
                  <Plus size={13} /> Add experience
                </button>

                {(draft.internships || []).map((e, i) => (
                  <div key={i} className="rounded-lg border border-cyan-400/15 bg-cyan-400/[0.03] p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-cyan-300">Internship {i + 1}</span>
                      <button onClick={() => patch((d) => { d.internships.splice(i, 1); })} className="text-slate-500 hover:text-rose-400" aria-label="Remove">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <Field label="Company" value={e.company} onChange={(v) => patch((d) => { d.internships[i].company = v; })} />
                      <Field label="Role" value={e.role} onChange={(v) => patch((d) => { d.internships[i].role = v; })} />
                    </div>
                    <Field label="Duration" value={e.duration} onChange={(v) => patch((d) => { d.internships[i].duration = v; })} placeholder="May – Jul 2025" />
                    <Field textarea label="Description" value={e.description} onChange={(v) => patch((d) => { d.internships[i].description = v; })} />
                  </div>
                ))}
                <button
                  onClick={() => patch((d) => { d.internships = [...(d.internships || []), { company: '', role: '', duration: '', description: '' }]; })}
                  className="btn-secondary btn-sm w-full"
                >
                  <Plus size={13} /> Add internship
                </button>
              </Panel>

              <Panel title="Achievements & certificates" icon={Award} count={(draft.achievements?.length || 0) + (draft.certificates?.length || 0)}>
                <ListEditor
                  label="Achievements"
                  items={draft.achievements || []}
                  onChange={(v) => patch((d) => { d.achievements = v; })}
                  placeholder="Ranked 312 in TechFest 2025"
                />
                <div className="pt-2 space-y-2.5">
                  <span className="label text-[11px]">Certificates</span>
                  {(draft.certificates || []).map((c, i) => (
                    <div key={i} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-bold text-slate-500">Certificate {i + 1}</span>
                        <button onClick={() => patch((d) => { d.certificates.splice(i, 1); })} className="text-slate-500 hover:text-rose-400" aria-label="Remove">
                          <Trash2 size={11} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Name" value={c.name} onChange={(v) => patch((d) => { d.certificates[i].name = v; })} />
                        <Field label="Issuer" value={c.issuer} onChange={(v) => patch((d) => { d.certificates[i].issuer = v; })} />
                        <Field label="Year" value={c.year} onChange={(v) => patch((d) => { d.certificates[i].year = v; })} />
                        <Field label="URL" value={c.url} onChange={(v) => patch((d) => { d.certificates[i].url = v; })} />
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => patch((d) => { d.certificates = [...(d.certificates || []), { name: '', issuer: '', year: '', url: '' }]; })}
                    className="btn-secondary btn-sm w-full"
                  >
                    <Plus size={13} /> Add certificate
                  </button>
                </div>
              </Panel>

              <Panel title="Coding profiles & languages" icon={Link2} count={(draft.codingProfiles?.length || 0) + (draft.languages?.length || 0)}>
                {(draft.codingProfiles || []).map((c, i) => (
                  <div key={i} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-bold text-slate-500">Profile {i + 1}</span>
                      <button onClick={() => patch((d) => { d.codingProfiles.splice(i, 1); })} className="text-slate-500 hover:text-rose-400" aria-label="Remove">
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Platform" value={c.platform} onChange={(v) => patch((d) => { d.codingProfiles[i].platform = v; })} placeholder="LeetCode" />
                      <Field label="Rating" value={c.rating} onChange={(v) => patch((d) => { d.codingProfiles[i].rating = v; })} placeholder="1680" />
                      <Field label="URL" value={c.url} onChange={(v) => patch((d) => { d.codingProfiles[i].url = v; })} />
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => patch((d) => { d.codingProfiles = [...(d.codingProfiles || []), { platform: '', url: '', rating: '' }]; })}
                  className="btn-secondary btn-sm w-full"
                >
                  <Plus size={13} /> Add coding profile
                </button>
                <ListEditor
                  label="Languages"
                  items={draft.languages || []}
                  onChange={(v) => patch((d) => { d.languages = v; })}
                  placeholder="English, Hindi…"
                />
              </Panel>
            </div>
          )}

          {tab === 'design' && (
            <div className="space-y-4">
              <MotionCard hover={false} className="p-4">
                <SectionHeader icon={Layers} title="Template" subtitle="Your content stays intact when you switch" className="mb-3.5" />
                <div className="grid grid-cols-2 gap-2.5">
                  {Object.entries(TEMPLATE_META).map(([key, meta]) => (
                    <motion.button
                      key={key}
                      whileHover={{ y: -4, rotateX: 6, rotateY: -4 }}
                      whileTap={{ scale: 0.98 }}
                      style={{ transformStyle: 'preserve-3d', perspective: 700 }}
                      onClick={() => patch((d) => { d.template = key; })}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        draft.template === key
                          ? 'border-orbit-violet/60 bg-orbit-violet/12'
                          : 'border-white/[0.08] bg-white/[0.025] hover:border-white/25'
                      }`}
                    >
                      <div className="w-full aspect-[3/4] rounded-lg overflow-hidden mb-2.5 bg-white relative">
                        <div style={{ transform: 'scale(0.135)', transformOrigin: 'top left', width: A4.width, pointerEvents: 'none' }}>
                          <ResumeRenderer resume={{ ...draft, template: key }} />
                        </div>
                      </div>
                      <p className="text-[12px] font-bold text-white">{meta.name}</p>
                      <p className="text-[10px] text-slate-500 leading-snug mt-0.5 line-clamp-2">{meta.description}</p>
                      <p className="text-[9.5px] text-orbit-cyan mt-1.5">{meta.best}</p>
                    </motion.button>
                  ))}
                </div>
              </MotionCard>

              <MotionCard hover={false} className="p-4">
                <SectionHeader icon={Palette} title="Accent colour" className="mb-3.5" />
                <div className="grid grid-cols-4 gap-2.5">
                  {ACCENTS.map((a) => (
                    <motion.button
                      key={a.hex}
                      whileHover={{ scale: 1.07 }}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => patch((d) => { d.accentColor = a.hex; })}
                      className={`rounded-xl border p-2.5 flex flex-col items-center gap-1.5 transition-all ${
                        accent === a.hex ? 'border-white/40 bg-white/[0.07]' : 'border-white/[0.08] hover:border-white/22'
                      }`}
                      title={a.name}
                    >
                      <span className="w-8 h-8 rounded-lg shadow-lg" style={{ background: a.hex }} />
                      <span className="text-[9.5px] text-slate-400 text-center leading-tight">{a.name}</span>
                    </motion.button>
                  ))}
                </div>
                <div className="mt-3.5">
                  <label className="label text-[11px]" htmlFor="customHex">Custom hex</label>
                  <div className="flex gap-2">
                    <input
                      id="customHex"
                      type="color"
                      value={accent}
                      onChange={(e) => patch((d) => { d.accentColor = e.target.value; })}
                      className="h-9 w-14 rounded-lg bg-transparent border border-white/10 cursor-pointer"
                    />
                    <input
                      className="input text-[13px] py-2 flex-1 font-mono"
                      value={accent}
                      onChange={(e) => patch((d) => { d.accentColor = e.target.value; })}
                    />
                  </div>
                </div>
              </MotionCard>
            </div>
          )}

          {tab === 'score' && (
            <MotionCard hover={false} className="p-5">
              <div className="flex items-center gap-5 mb-5">
                <ProgressRing value={completeness} size={92} tone={completeness >= 80 ? 'mint' : 'amber'} sublabel="complete" />
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-white mb-1">
                    {completeness >= 90 ? 'Recruiter ready' : completeness >= 70 ? 'Nearly there' : 'Needs more substance'}
                  </p>
                  <p className="text-[12px] text-slate-400 leading-relaxed">
                    Ten checks, each worth ten points. The score is stored with the resume and shown to the placement
                    cell when you apply.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                {completenessChecks.map((c) => (
                  <div
                    key={c.label}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] ${
                      c.ok ? 'text-emerald-200 bg-emerald-400/[0.055]' : 'text-slate-400 bg-white/[0.025]'
                    }`}
                  >
                    {c.ok ? (
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle size={14} className="text-amber-400 shrink-0" />
                    )}
                    {c.label}
                    <span className="ml-auto text-[10px] tabular-nums opacity-60">{c.ok ? '+10' : '0'}</span>
                  </div>
                ))}
              </div>

              {dirty && (
                <Callout tone="amber" icon={Info} className="mt-4">
                  Saved score is {savedCompleteness}%. Save to update it in MongoDB.
                </Callout>
              )}
            </MotionCard>
          )}
        </div>

        {/* ----------------------------------------------- preview column */}
        <div className="hidden xl:block sticky top-20">
          <MotionCard hover={false} className="p-4">
            <div className="flex items-center justify-between gap-3 mb-3.5">
              <div>
                <p className="text-[13px] font-bold text-white">Live preview</p>
                <p className="text-[11px] text-slate-500">
                  {TEMPLATE_META[draft.template]?.name} · exactly what the PDF will contain
                </p>
              </div>
              <button onClick={exportPDF} disabled={exporting} className="btn-primary btn-sm">
                {exporting ? <><Loader2 size={13} className="animate-spin" /> Exporting</> : <><Download size={13} /> Download PDF</>}
              </button>
            </div>

            <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-300/5 p-4 max-h-[calc(100vh-190px)] overflow-y-auto scrollbar-thin">
              <motion.div
                key={`${draft.template}-${accent}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="mx-auto shadow-2xl"
                style={{ width: A4.width * 0.72 }}
              >
                <ResumeRenderer resume={draft} scale={0.72} />
              </motion.div>
            </div>
          </MotionCard>
        </div>
      </div>

      {/* offscreen full-size node used for the PDF snapshot */}
      <div style={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none', opacity: 0 }} aria-hidden="true">
        <div ref={printRef} style={{ width: A4.width, background: '#fff' }}>
          <ResumeRenderer resume={draft} />
        </div>
      </div>

      {/* template picker modal */}
      <Modal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="Choose a template"
        subtitle="Switching never loses your content — it is one dataset rendered four ways."
        icon={Layers}
        size="lg"
        footer={<button className="btn-primary" onClick={() => setTemplateOpen(false)}>Done</button>}
      >
        <div className="grid sm:grid-cols-2 gap-4">
          {Object.entries(TEMPLATE_META).map(([key, meta]) => (
            <motion.button
              key={key}
              whileHover={{ y: -6, rotateY: -5, rotateX: 5 }}
              style={{ transformStyle: 'preserve-3d', perspective: 900 }}
              onClick={() => patch((d) => { d.template = key; })}
              className={`rounded-xl border p-3.5 text-left transition-all ${
                draft.template === key
                  ? 'border-orbit-violet/60 bg-orbit-violet/12 shadow-glow'
                  : 'border-white/[0.08] bg-white/[0.025] hover:border-white/25'
              }`}
            >
              <div className="w-full aspect-[3/4] rounded-lg overflow-hidden mb-3 bg-white">
                <div style={{ transform: 'scale(0.28)', transformOrigin: 'top left', width: A4.width, pointerEvents: 'none' }}>
                  <ResumeRenderer resume={{ ...draft, template: key }} />
                </div>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[13.5px] font-bold text-white">{meta.name}</p>
                {draft.template === key && <CheckCircle2 size={14} className="text-orbit-violet" />}
              </div>
              <p className="text-[11.5px] text-slate-400 leading-relaxed">{meta.description}</p>
              <p className="text-[10.5px] text-orbit-cyan mt-1.5">Best for: {meta.best}</p>
            </motion.button>
          ))}
        </div>
      </Modal>

      {/* mobile preview */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Preview"
        icon={Eye}
        size="xl"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setPreviewOpen(false)}>Close</button>
            <button className="btn-primary" onClick={exportPDF} disabled={exporting}>
              {exporting ? <Spinner size={14} /> : <Download size={14} />} Download PDF
            </button>
          </>
        }
      >
        <div className="overflow-auto scrollbar-thin bg-slate-300/5 rounded-xl p-3">
          <div className="mx-auto" style={{ width: A4.width * 0.6 }}>
            <ResumeRenderer resume={draft} scale={0.6} />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete this resume?"
        message={`"${deleting?.name}" and all its content will be permanently removed. Applications that already used it keep their record.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
