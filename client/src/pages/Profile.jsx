import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User, Save, GraduationCap, Target, Link2, Languages, Award, Flame,
  CheckCircle2, AlertCircle, Github, Linkedin, Globe, Code2, Phone, MapPin,
  Mail, BookOpen, TrendingUp, Info, Plus, X, Briefcase, Sparkles,
} from 'lucide-react';
import { userAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  PageHeader, LoadingScreen, Badge, MotionCard, ProgressRing, ProgressBar,
  Spinner, Callout, SectionHeader, StatCard, Avatar,
} from '../components/ui/Primitives';

const BRANCHES = ['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Chemical', 'AIML', 'Data Science', 'Other'];
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const LANGS = ['English', 'Hindi', 'Hinglish'];
const GOAL_OPTIONS = [
  'campus placement', 'internship', 'mern developer', 'sde dsa',
  'frontend developer', 'gate cse', 'higher studies', 'product company',
];

function TagInput({ items = [], onChange, placeholder, suggestions = [] }) {
  const [draft, setDraft] = useState('');
  const add = (v) => {
    const val = (v ?? draft).trim();
    if (!val || items.some((i) => i.toLowerCase() === val.toLowerCase())) return;
    onChange([...items, val]);
    setDraft('');
  };
  return (
    <div>
      <div className="flex gap-1.5 mb-2">
        <input
          className="input flex-1"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button onClick={() => add()} className="btn-secondary btn-sm px-3" aria-label="Add"><Plus size={14} /></button>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {items.map((it) => (
          <span key={it} className="inline-flex items-center gap-1.5 chip-violet">
            {it}
            <button onClick={() => onChange(items.filter((x) => x !== it))} className="opacity-60 hover:opacity-100" aria-label={`Remove ${it}`}>
              <X size={10} />
            </button>
          </span>
        ))}
        {items.length === 0 && <span className="text-[11px] text-slate-600">Nothing added yet.</span>}
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions
            .filter((s) => !items.some((i) => i.toLowerCase() === s.toLowerCase()))
            .slice(0, 6)
            .map((s) => (
              <button key={s} onClick={() => add(s)} className="text-[10.5px] px-2 py-0.5 rounded-full border border-white/12 text-slate-500 hover:text-slate-200 hover:border-white/30 transition-all">
                + {s}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export default function Profile() {
  const { user, updateProfile, refresh } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [fullName, setFullName] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      college: '', branch: '', graduationYear: '', cgpa: '', backlogCount: 0,
      skills: [], currentLevel: 'beginner', weeklyStudyHours: 10, careerGoals: [],
      examGoals: [], preferredLanguage: 'English', githubUrl: '', linkedinUrl: '',
      codingProfileUrl: '', portfolioUrl: '', phone: '', location: '', bio: '',
      ...(user.profile || {}),
    });
    setFullName(user.fullName || '');
    userAPI.stats().then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({
        fullName,
        profile: {
          ...form,
          graduationYear: form.graduationYear ? Number(form.graduationYear) : undefined,
          cgpa: form.cgpa !== '' ? Number(form.cgpa) : undefined,
          backlogCount: Number(form.backlogCount) || 0,
          weeklyStudyHours: Number(form.weeklyStudyHours) || 10,
        },
      });
      toast.success('Profile saved — your eligibility for every drive was recalculated.');
      setDirty(false);
      await refresh();
      userAPI.stats().then(setStats).catch(() => {});
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) return <LoadingScreen label="Loading your profile…" />;

  const checks = [
    { label: 'Full name', ok: Boolean(fullName) },
    { label: 'College', ok: Boolean(form.college) },
    { label: 'Branch', ok: Boolean(form.branch) },
    { label: 'Graduation year', ok: Boolean(form.graduationYear) },
    { label: 'CGPA', ok: form.cgpa !== '' && form.cgpa != null },
    { label: 'Backlog count', ok: form.backlogCount != null },
    { label: 'At least 3 skills', ok: (form.skills || []).length >= 3 },
    { label: 'Current level', ok: Boolean(form.currentLevel) },
    { label: 'Weekly study hours', ok: Boolean(form.weeklyStudyHours) },
    { label: 'A career goal', ok: (form.careerGoals || []).length > 0 },
    { label: 'GitHub URL', ok: Boolean(form.githubUrl) },
    { label: 'LinkedIn URL', ok: Boolean(form.linkedinUrl) },
    { label: 'Phone', ok: Boolean(form.phone) },
    { label: 'Location', ok: Boolean(form.location) },
    { label: 'Short bio', ok: Boolean(form.bio) },
  ];
  const completion = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  const missing = checks.filter((c) => !c.ok);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={User}
        title="My Profile"
        subtitle="This is what every eligibility rule reads. Keeping it accurate is the single highest-leverage thing you can do here."
        badge={dirty ? <Badge tone="amber">Unsaved changes</Badge> : <Badge tone="mint">Saved</Badge>}
        action={
          <button onClick={save} disabled={saving || !dirty} className="btn-primary">
            {saving ? <><Spinner size={14} /> Saving…</> : <><Save size={15} /> Save profile</>}
          </button>
        }
      />

      {/* identity card */}
      <MotionCard hover={false} gradient className="p-6 relative overflow-hidden">
        <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-orbit-violet/15 blur-3xl pointer-events-none" />
        <div className="relative flex items-center gap-5 flex-wrap">
          <Avatar name={user.fullName} color={user.avatarColor} size={72} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <h2 className="text-xl font-bold text-white font-display">{user.fullName}</h2>
              <Badge tone={user.role === 'admin' ? 'violet' : user.role === 'senior' ? 'cyan' : 'mint'}>
                {user.role === 'admin' ? 'Placement Cell' : user.role === 'senior' ? 'Senior / Alumni' : 'Student'}
              </Badge>
            </div>
            <p className="text-[13px] text-slate-400 flex items-center gap-1.5"><Mail size={12} /> {user.email}</p>
            {(form.college || form.branch) && (
              <p className="text-[13px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                <GraduationCap size={12} /> {[form.branch, form.college, form.graduationYear].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <ProgressRing value={completion} size={80} tone={completion >= 80 ? 'mint' : 'amber'} sublabel="complete" />
            {user.streak && (
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-400 font-display flex items-center gap-1.5">
                  <Flame size={20} /> {user.streak.current}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">day streak</p>
              </div>
            )}
          </div>
        </div>
      </MotionCard>

      {completion < 100 && (
        <Callout tone={completion >= 80 ? 'cyan' : 'amber'} icon={AlertCircle} title={`${missing.length} field${missing.length === 1 ? '' : 's'} still empty`}>
          {missing.map((m) => m.label).join(', ')}. Drives filter on CGPA, branch, graduation year and backlogs — an
          incomplete profile means CampusOrbit has to guess, and it will guess conservatively.
        </Callout>
      )}

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon={BookOpen} label="Lessons done" value={stats.lessonsCompleted ?? stats.lessons ?? 0} sub="Across all paths" tone="violet" />
          <StatCard icon={Briefcase} label="Applications" value={stats.applications ?? 0} sub="In your pipeline" tone="cyan" delay={0.06} />
          <StatCard icon={Award} label="Quiz attempts" value={stats.quizAttempts ?? 0} sub="Practice attempts" tone="mint" delay={0.12} />
          <StatCard icon={TrendingUp} label="Longest streak" value={`${user.streak?.longest || 0}d`} sub="Personal best" tone="amber" delay={0.18} />
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
        <div className="space-y-4">
          {/* academic */}
          <MotionCard hover={false} className="p-5">
            <SectionHeader
              icon={GraduationCap}
              title="Academic details"
              subtitle="These four fields decide your eligibility for every drive"
              className="mb-4"
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="fname">Full name</label>
                <input id="fname" className="input" value={fullName} onChange={(e) => { setFullName(e.target.value); setDirty(true); }} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="college">College</label>
                <input id="college" className="input" placeholder="e.g. Institute of Engineering & Technology, Lucknow" value={form.college} onChange={(e) => set('college', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="branch">Branch</label>
                <select id="branch" className="input" value={form.branch} onChange={(e) => set('branch', e.target.value)}>
                  <option value="">Select branch…</option>
                  {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="gyear">Graduation year</label>
                <select id="gyear" className="input" value={form.graduationYear} onChange={(e) => set('graduationYear', e.target.value)}>
                  <option value="">Select year…</option>
                  {[2025, 2026, 2027, 2028, 2029, 2030].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="cgpa">CGPA <span className="text-slate-600">(out of 10)</span></label>
                <input
                  id="cgpa" className="input" type="number" step="0.01" min="0" max="10"
                  placeholder="8.2" value={form.cgpa} onChange={(e) => set('cgpa', e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="backlogs">Active backlogs</label>
                <input
                  id="backlogs" className="input" type="number" min="0" max="30"
                  value={form.backlogCount} onChange={(e) => set('backlogCount', e.target.value)}
                />
              </div>
            </div>
          </MotionCard>

          {/* skills & goals */}
          <MotionCard hover={false} className="p-5">
            <SectionHeader icon={Target} title="Skills & goals" subtitle="Drives the match score and your path recommendation" className="mb-4" />
            <div className="space-y-4">
              <div>
                <span className="label">Skills</span>
                <TagInput
                  items={form.skills}
                  onChange={(v) => set('skills', v)}
                  placeholder="Type a skill and press Enter"
                  suggestions={['JavaScript', 'React', 'Node.js', 'MongoDB', 'Express', 'DSA', 'SQL', 'Python', 'Git', 'HTML/CSS', 'TypeScript', 'C++']}
                />
              </div>

              <div>
                <span className="label">Career goals</span>
                <TagInput
                  items={form.careerGoals}
                  onChange={(v) => set('careerGoals', v)}
                  placeholder="Add a goal"
                  suggestions={GOAL_OPTIONS}
                />
              </div>

              <div>
                <span className="label">Exam goals (optional)</span>
                <TagInput
                  items={form.examGoals}
                  onChange={(v) => set('examGoals', v)}
                  placeholder="e.g. GATE 2027"
                  suggestions={['GATE CSE', 'GATE DA', 'CAT', 'UGC NET', 'PSU exams']}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <span className="label">Current level</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {LEVELS.map((l) => (
                      <button
                        key={l}
                        onClick={() => set('currentLevel', l)}
                        className={`rounded-lg border px-2 py-2 text-[12px] font-medium capitalize transition-all ${
                          form.currentLevel === l
                            ? 'border-orbit-violet/60 bg-orbit-violet/12 text-white'
                            : 'border-white/10 text-slate-400 hover:border-white/25'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="hours">
                    Weekly study hours — <span className="text-orbit-cyan">{form.weeklyStudyHours}h</span>
                  </label>
                  <input
                    id="hours" type="range" min="2" max="40"
                    value={form.weeklyStudyHours}
                    onChange={(e) => set('weeklyStudyHours', e.target.value)}
                    className="w-full accent-orbit-violet cursor-pointer mt-2"
                  />
                </div>
              </div>

              <div>
                <span className="label">Preferred explanation language</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {LANGS.map((l) => (
                    <button
                      key={l}
                      onClick={() => set('preferredLanguage', l)}
                      className={`rounded-lg border px-2 py-2 text-[12px] font-medium transition-all ${
                        form.preferredLanguage === l
                          ? 'border-orbit-cyan/60 bg-cyan-400/12 text-white'
                          : 'border-white/10 text-slate-400 hover:border-white/25'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Smart Notes include a Hinglish explanation for every lesson regardless — this just sets which one
                  opens first.
                </p>
              </div>
            </div>
          </MotionCard>

          {/* links */}
          <MotionCard hover={false} className="p-5">
            <SectionHeader icon={Link2} title="Links & contact" subtitle="Auto-filled into your resumes and applications" className="mb-4" />
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { k: 'githubUrl', label: 'GitHub', icon: Github, ph: 'https://github.com/you' },
                { k: 'linkedinUrl', label: 'LinkedIn', icon: Linkedin, ph: 'https://linkedin.com/in/you' },
                { k: 'portfolioUrl', label: 'Portfolio', icon: Globe, ph: 'https://you.dev' },
                { k: 'codingProfileUrl', label: 'Coding profile', icon: Code2, ph: 'https://leetcode.com/you' },
                { k: 'phone', label: 'Phone', icon: Phone, ph: '+91 98765 43210' },
                { k: 'location', label: 'Location', icon: MapPin, ph: 'Lucknow, India' },
              ].map((f) => (
                <div key={f.k}>
                  <label className="label" htmlFor={f.k}>{f.label}</label>
                  <div className="relative">
                    <f.icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      id={f.k}
                      className="input pl-10"
                      placeholder={f.ph}
                      value={form[f.k] || ''}
                      onChange={(e) => set(f.k, e.target.value)}
                    />
                  </div>
                </div>
              ))}
              <div className="sm:col-span-2">
                <label className="label" htmlFor="bio">Short bio</label>
                <textarea
                  id="bio"
                  className="input min-h-[90px] resize-y"
                  placeholder="Two lines on who you are and what you are building towards."
                  value={form.bio}
                  onChange={(e) => set('bio', e.target.value)}
                />
              </div>
            </div>
          </MotionCard>

          <button onClick={save} disabled={saving || !dirty} className="btn-primary w-full">
            {saving ? <><Spinner size={14} /> Saving…</> : <><Save size={15} /> Save profile</>}
          </button>
        </div>

        {/* completion sidebar */}
        <div className="space-y-4 lg:sticky lg:top-20">
          <MotionCard hover={false} className="p-5">
            <SectionHeader icon={CheckCircle2} title="Profile completion" subtitle="Fifteen checks" className="mb-4" />
            <div className="flex justify-center mb-4">
              <ProgressRing value={completion} size={110} stroke={9} tone={completion >= 80 ? 'mint' : 'amber'} sublabel="complete" />
            </div>
            <div className="space-y-1">
              {checks.map((c) => (
                <div
                  key={c.label}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12px] ${
                    c.ok ? 'text-emerald-300' : 'text-slate-500'
                  }`}
                >
                  {c.ok ? (
                    <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-white/22 shrink-0" />
                  )}
                  {c.label}
                </div>
              ))}
            </div>
          </MotionCard>

          <Callout tone="violet" icon={Info} title="Why we ask for CGPA and backlogs">
            Only to run the eligibility rules your placement cell defines — nothing else reads them. The rules are
            plain JavaScript you can see the output of on every opportunity page, including which specific rule you
            fail and by how much.
          </Callout>

          <div className="grid grid-cols-2 gap-2.5">
            <Link to="/resume-studio" className="btn-secondary btn-sm">
              <Sparkles size={13} /> Resume Studio
            </Link>
            <Link to="/opportunities" className="btn-secondary btn-sm">
              <Briefcase size={13} /> See eligibility
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
