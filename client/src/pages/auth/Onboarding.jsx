import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Orbit, ArrowRight, ArrowLeft, Check, Target, Clock, Sparkles, GraduationCap,
  Rocket, BookOpen, Code2, Cpu, Layers, Trophy, Award, Plus, X, Languages,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { pathAPI } from '../../services/api';
import StarField, { AuroraBlobs } from '../../components/three/StarField';
import { Spinner, Badge, ProgressBar } from '../../components/ui/Primitives';

const GOALS = [
  { value: 'campus placement', label: 'Campus placement', icon: Trophy, body: 'Crack the on-campus drive at my college.' },
  { value: 'internship', label: 'Internship', icon: Rocket, body: 'Land a summer / 6-month internship.' },
  { value: 'mern developer', label: 'Full-stack (MERN)', icon: Layers, body: 'Build and ship real web products.' },
  { value: 'sde dsa', label: 'SDE / DSA', icon: Code2, body: 'Clear DSA rounds at product companies.' },
  { value: 'frontend developer', label: 'Frontend developer', icon: BookOpen, body: 'Specialise in React & modern UI.' },
  { value: 'gate cse', label: 'GATE CSE', icon: Cpu, body: 'Score high in GATE Computer Science.' },
];

const LEVELS = [
  { value: 'beginner', label: 'Beginner', body: 'I know basic programming but have never built or solved much.' },
  { value: 'intermediate', label: 'Intermediate', body: 'I have built small projects or solved 50+ problems.' },
  { value: 'advanced', label: 'Advanced', body: 'I am comfortable and want to close specific gaps fast.' },
];

const SKILL_SUGGESTIONS = [
  'JavaScript', 'React', 'Node.js', 'Express', 'MongoDB', 'Python', 'Java', 'C++',
  'HTML', 'CSS', 'Tailwind', 'Git', 'SQL', 'Data Structures', 'Algorithms',
  'Operating Systems', 'DBMS', 'Computer Networks', 'REST APIs', 'TypeScript',
];

const BRANCHES = [
  'Computer Science', 'Information Technology', 'Electronics & Communication',
  'Electrical', 'Mechanical', 'Civil', 'Chemical', 'Biotechnology', 'Other',
];

const STEPS = [
  { n: 1, title: 'About you', icon: GraduationCap },
  { n: 2, title: 'Your goal', icon: Target },
  { n: 3, title: 'Your pace', icon: Clock },
];

export default function Onboarding() {
  const { user, updateProfile, refresh, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [skillInput, setSkillInput] = useState('');
  const [errors, setErrors] = useState({});
  const submittingRef = useRef(false);

  const [form, setForm] = useState({
    college: '',
    branch: '',
    graduationYear: new Date().getFullYear() + 1,
    cgpa: '',
    backlogCount: 0,
    skills: [],
    goal: '',
    currentLevel: 'beginner',
    weeklyStudyHours: 10,
    timelineWeeks: 12,
    preferredLanguage: 'English',
    phone: '',
  });

  useEffect(() => {
    if (user?.profile) {
      setForm((f) => ({
        ...f,
        college: user.profile.college || '',
        branch: user.profile.branch || '',
        graduationYear: user.profile.graduationYear || f.graduationYear,
        cgpa: user.profile.cgpa ?? '',
        backlogCount: user.profile.backlogCount ?? 0,
        skills: user.profile.skills?.length ? user.profile.skills : [],
        currentLevel: user.profile.currentLevel || 'beginner',
        weeklyStudyHours: user.profile.weeklyStudyHours || 10,
        preferredLanguage: user.profile.preferredLanguage || 'English',
        phone: user.profile.phone || '',
      }));
    }
  }, [user]);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const addSkill = (s) => {
    const clean = s.trim();
    if (!clean) return;
    if (form.skills.some((x) => x.toLowerCase() === clean.toLowerCase())) return;
    set('skills', [...form.skills, clean]);
    setSkillInput('');
  };

  const validateStep = () => {
    const e = {};
    if (step === 1) {
      if (!form.college.trim()) e.college = 'Your college helps the placement cell filter drives.';
      if (!form.branch) e.branch = 'Select your branch — eligibility rules use it.';
      if (!form.graduationYear) e.graduationYear = 'Graduation year is required.';
      if (form.cgpa === '' || Number.isNaN(Number(form.cgpa))) e.cgpa = 'Enter your CGPA (0–10).';
      else if (Number(form.cgpa) < 0 || Number(form.cgpa) > 10) e.cgpa = 'CGPA must be between 0 and 10.';
    }
    if (step === 2) {
      if (!form.goal) e.goal = 'Pick one goal — CampusOrbit only ever gives you one path.';
      if (form.skills.length < 3) e.skills = 'Add at least 3 skills so we can calibrate your start point.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = async () => {
    if (!validateStep()) return;
    if (step < 3) {
      setStep((s) => s + 1);
      return;
    }
    // Final step -> save profile then fetch the single recommendation.
    setBusy(true);
    try {
      await updateProfile({
        profile: {
          college: form.college.trim(),
          branch: form.branch,
          graduationYear: Number(form.graduationYear),
          cgpa: Number(form.cgpa),
          backlogCount: Number(form.backlogCount) || 0,
          skills: form.skills,
          currentLevel: form.currentLevel,
          weeklyStudyHours: Number(form.weeklyStudyHours),
          careerGoals: [form.goal],
          preferredLanguage: form.preferredLanguage,
          phone: form.phone,
        },
      });
      const rec = await pathAPI.recommend({
        goal: form.goal,
        level: form.currentLevel,
        weeklyHours: Number(form.weeklyStudyHours),
        timelineWeeks: Number(form.timelineWeeks),
      });
      setRecommendation(rec);
      setStep(4);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const startPath = async () => {
    // A ref guard, not just `busy`: setState is async, so a fast double-click
    // can fire this twice before the disabled prop has rendered.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    try {
      // The server marks onboarding complete inside this same call, so there
      // is no second request that can fail and strand the account.
      const res = await pathAPI.start(recommendation.recommended._id, {
        weeklyHours: Number(form.weeklyStudyHours),
        timelineWeeks: Number(form.timelineWeeks),
        transferProgress: true,
        reason: recommendation.reasons?.[0] || 'Recommended during onboarding',
      });

      // Prefer the authoritative user the server just returned; fall back to a
      // refresh only if an older server build did not include it.
      if (res?.user) setUser(res.user);
      else await refresh();

      toast.success('Your orbit is live. Three tasks are waiting.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      // "Already enrolled" is not a failure -- it means the goal is already
      // met (a retry, a stale duplicate request, or a second tab got there
      // first). Treat it as success and move on instead of trapping the user
      // behind an error toast on a screen they cannot leave.
      if (err.status === 409 || /already enrolled/i.test(err.message || '')) {
        await refresh();
        navigate('/dashboard', { replace: true });
        return;
      }
      toast.error(err.message);
      submittingRef.current = false;
      setBusy(false);
    }
  };

  const progressPct = step === 4 ? 100 : Math.round(((step - 1) / 3) * 100);

  return (
    <div className="min-h-screen relative py-8 px-4 sm:px-6">
      <StarField density={0.00015} />
      <AuroraBlobs />

      <div className="relative z-10 max-w-3xl mx-auto">
        {/* header */}
        <div className="flex items-center gap-2.5 mb-7">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orbit-violet to-orbit-indigo flex items-center justify-center border border-white/15">
            <Orbit size={20} className="text-white" />
          </div>
          <div>
            <p className="text-lg font-bold text-white font-display leading-tight">
              Campus<span className="text-gradient">Orbit</span>
            </p>
            <p className="text-[11px] text-slate-500">Setting up your orbit, {user?.fullName?.split(' ')[0]}</p>
          </div>
        </div>

        {/* Escape hatch: never let a student who already has a path be trapped
            on this screen with no way forward. */}
        {user?.activePathId && (
          <div className="mb-6 rounded-xl border border-orbit-cyan/30 bg-orbit-cyan/[0.07] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-cyan-100 flex-1">
              You already have an active learning path. You don&apos;t need to set up again.
            </p>
            <button
              type="button"
              onClick={() => navigate('/dashboard', { replace: true })}
              className="btn-primary px-4 py-2 text-sm whitespace-nowrap w-full sm:w-auto"
            >
              Go to dashboard <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* stepper */}
        {step < 4 && (
          <div className="mb-7">
            <div className="flex items-center justify-between mb-3">
              {STEPS.map((s, i) => {
                const done = step > s.n;
                const active = step === s.n;
                return (
                  <div key={s.n} className="flex items-center flex-1 last:flex-none">
                    <div className="flex items-center gap-2.5">
                      <motion.div
                        animate={{ scale: active ? 1.08 : 1 }}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-colors ${
                          done
                            ? 'bg-emerald-500/18 border-emerald-400/40 text-emerald-300'
                            : active
                            ? 'bg-orbit-violet/22 border-orbit-violet/50 text-orbit-violet shadow-glow'
                            : 'bg-white/[0.035] border-white/10 text-slate-500'
                        }`}
                      >
                        {done ? <Check size={16} strokeWidth={3} /> : <s.icon size={16} />}
                      </motion.div>
                      <span className={`text-xs font-semibold hidden sm:block ${active ? 'text-white' : 'text-slate-500'}`}>
                        {s.title}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="flex-1 h-px mx-3 bg-white/10 relative overflow-hidden">
                        <motion.div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-orbit-violet to-orbit-cyan"
                          initial={{ width: 0 }}
                          animate={{ width: step > s.n ? '100%' : '0%' }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <ProgressBar value={progressPct} height="h-1" />
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ---------------------------------------------------- STEP 1 */}
          {step === 1 && (
            <motion.div
              key="s1"
              initial={{ opacity: 0, x: 26 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -26 }}
              transition={{ duration: 0.25 }}
              className="gradient-border p-6 sm:p-8"
            >
              <h1 className="text-2xl font-bold text-white font-display mb-1.5">Tell us about you</h1>
              <p className="text-sm text-slate-400 mb-6">
                These exact fields drive placement eligibility. Accurate data = accurate opportunities.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="college">College / University</label>
                  <input
                    id="college"
                    className="input"
                    placeholder="e.g. Institute of Engineering & Technology, Lucknow"
                    value={form.college}
                    onChange={(e) => set('college', e.target.value)}
                  />
                  {errors.college && <p className="field-error">{errors.college}</p>}
                </div>

                <div>
                  <label className="label" htmlFor="branch">Branch</label>
                  <select id="branch" className="input" value={form.branch} onChange={(e) => set('branch', e.target.value)}>
                    <option value="">Select your branch</option>
                    {BRANCHES.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  {errors.branch && <p className="field-error">{errors.branch}</p>}
                </div>

                <div>
                  <label className="label" htmlFor="gradYear">Graduation year</label>
                  <select
                    id="gradYear"
                    className="input"
                    value={form.graduationYear}
                    onChange={(e) => set('graduationYear', e.target.value)}
                  >
                    {[0, 1, 2, 3, 4, 5].map((o) => {
                      const y = new Date().getFullYear() + o - 1;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                  {errors.graduationYear && <p className="field-error">{errors.graduationYear}</p>}
                </div>

                <div>
                  <label className="label" htmlFor="cgpa">Current CGPA (out of 10)</label>
                  <input
                    id="cgpa"
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    className="input"
                    placeholder="8.2"
                    value={form.cgpa}
                    onChange={(e) => set('cgpa', e.target.value)}
                  />
                  {errors.cgpa && <p className="field-error">{errors.cgpa}</p>}
                </div>

                <div>
                  <label className="label" htmlFor="backlogs">Active backlogs</label>
                  <input
                    id="backlogs"
                    type="number"
                    min="0"
                    className="input"
                    value={form.backlogCount}
                    onChange={(e) => set('backlogCount', e.target.value)}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="phone">Phone (optional)</label>
                  <input
                    id="phone"
                    className="input"
                    placeholder="+91 90000 00000"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="lang">
                    <Languages size={11} className="inline mr-1" /> Explanation language
                  </label>
                  <select
                    id="lang"
                    className="input"
                    value={form.preferredLanguage}
                    onChange={(e) => set('preferredLanguage', e.target.value)}
                  >
                    <option value="English">English</option>
                    <option value="Hinglish">Hinglish (Hindi + English mix)</option>
                    <option value="Hindi">Hindi</option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Notes include a Hinglish explanation for every concept.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ---------------------------------------------------- STEP 2 */}
          {step === 2 && (
            <motion.div
              key="s2"
              initial={{ opacity: 0, x: 26 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -26 }}
              transition={{ duration: 0.25 }}
              className="gradient-border p-6 sm:p-8"
            >
              <h1 className="text-2xl font-bold text-white font-display mb-1.5">What are you aiming at?</h1>
              <p className="text-sm text-slate-400 mb-6">
                Choose <strong className="text-slate-200">one</strong>. You can switch paths later and your completed
                topics transfer across.
              </p>

              <div className="grid sm:grid-cols-2 gap-2.5 mb-6">
                {GOALS.map((g) => {
                  const active = form.goal === g.value;
                  return (
                    <motion.button
                      key={g.value}
                      type="button"
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => set('goal', g.value)}
                      className={`relative text-left rounded-xl border p-3.5 transition-all ${
                        active
                          ? 'border-orbit-violet/60 bg-orbit-violet/12 shadow-glow'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                      }`}
                    >
                      {active && (
                        <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-orbit-violet flex items-center justify-center">
                          <Check size={10} className="text-white" strokeWidth={3} />
                        </span>
                      )}
                      <g.icon size={18} className={active ? 'text-orbit-violet' : 'text-slate-400'} />
                      <p className="text-sm font-bold text-white mt-2">{g.label}</p>
                      <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{g.body}</p>
                    </motion.button>
                  );
                })}
              </div>
              {errors.goal && <p className="field-error mb-4">{errors.goal}</p>}

              <div>
                <label className="label" htmlFor="skills">
                  Skills you already have <span className="text-slate-500 normal-case">({form.skills.length} added, min 3)</span>
                </label>
                <div className="flex gap-2 mb-2.5">
                  <input
                    id="skills"
                    className="input"
                    placeholder="Type a skill and press Enter"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSkill(skillInput);
                      }
                    }}
                  />
                  <button type="button" className="btn-secondary shrink-0" onClick={() => addSkill(skillInput)}>
                    <Plus size={15} />
                  </button>
                </div>

                {form.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {form.skills.map((s) => (
                      <motion.span
                        key={s}
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="chip-violet"
                      >
                        {s}
                        <button
                          type="button"
                          onClick={() => set('skills', form.skills.filter((x) => x !== s))}
                          className="hover:text-white"
                          aria-label={`Remove ${s}`}
                        >
                          <X size={11} />
                        </button>
                      </motion.span>
                    ))}
                  </div>
                )}

                <p className="text-[11px] text-slate-500 mb-2">Quick add:</p>
                <div className="flex flex-wrap gap-1.5">
                  {SKILL_SUGGESTIONS.filter((s) => !form.skills.includes(s)).slice(0, 12).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addSkill(s)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-white/10 text-slate-400 hover:border-orbit-cyan/40 hover:text-cyan-200 transition-colors"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
                {errors.skills && <p className="field-error mt-2">{errors.skills}</p>}
              </div>
            </motion.div>
          )}

          {/* ---------------------------------------------------- STEP 3 */}
          {step === 3 && (
            <motion.div
              key="s3"
              initial={{ opacity: 0, x: 26 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -26 }}
              transition={{ duration: 0.25 }}
              className="gradient-border p-6 sm:p-8"
            >
              <h1 className="text-2xl font-bold text-white font-display mb-1.5">How fast can you realistically go?</h1>
              <p className="text-sm text-slate-400 mb-6">
                Be honest. An achievable plan you finish beats an ambitious plan you abandon in week two.
              </p>

              <div className="mb-6">
                <span className="label">Your current level</span>
                <div className="space-y-2">
                  {LEVELS.map((l) => {
                    const active = form.currentLevel === l.value;
                    return (
                      <button
                        key={l.value}
                        type="button"
                        onClick={() => set('currentLevel', l.value)}
                        className={`w-full text-left rounded-xl border p-3.5 transition-all flex items-start gap-3 ${
                          active
                            ? 'border-orbit-violet/60 bg-orbit-violet/12'
                            : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                            active ? 'border-orbit-violet' : 'border-white/25'
                          }`}
                        >
                          {active && <span className="w-2 h-2 rounded-full bg-orbit-violet" />}
                        </span>
                        <span>
                          <span className="block text-sm font-bold text-white">{l.label}</span>
                          <span className="block text-[11px] text-slate-400 mt-0.5">{l.body}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="label" htmlFor="hours">
                    Study hours per week — <span className="text-orbit-cyan">{form.weeklyStudyHours}h</span>
                  </label>
                  <input
                    id="hours"
                    type="range"
                    min="2"
                    max="40"
                    step="1"
                    value={form.weeklyStudyHours}
                    onChange={(e) => set('weeklyStudyHours', e.target.value)}
                    className="w-full accent-orbit-violet cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>2h</span><span>20h</span><span>40h</span>
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="timeline">
                    Target timeline — <span className="text-orbit-cyan">{form.timelineWeeks} weeks</span>
                  </label>
                  <input
                    id="timeline"
                    type="range"
                    min="4"
                    max="52"
                    step="1"
                    value={form.timelineWeeks}
                    onChange={(e) => set('timelineWeeks', e.target.value)}
                    className="w-full accent-orbit-cyan cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>4w</span><span>26w</span><span>52w</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-cyan-400/22 bg-cyan-400/[0.06] px-4 py-3">
                <p className="text-[13px] text-cyan-100/85 leading-relaxed">
                  That is roughly{' '}
                  <strong className="text-cyan-200">
                    {Math.round(form.weeklyStudyHours * form.timelineWeeks)} total hours
                  </strong>{' '}
                  of focused preparation. We will split it into milestones and tell you exactly how many lessons
                  to finish each week.
                </p>
              </div>
            </motion.div>
          )}

          {/* ------------------------------------------- STEP 4: result */}
          {step === 4 && recommendation && (
            <motion.div
              key="s4"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
              className="space-y-4"
            >
              <div className="gradient-border p-6 sm:p-8 relative overflow-hidden">
                <div className="absolute -top-20 -right-20 w-52 h-52 rounded-full bg-orbit-violet/20 blur-3xl" />
                <div className="relative">
                  <Badge tone="cyan" icon={Sparkles} className="mb-4">Your one path</Badge>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white font-display mb-2">
                    {recommendation.recommended.title}
                  </h1>
                  <p className="text-sm text-slate-300 leading-relaxed mb-5">
                    {recommendation.recommended.tagline || recommendation.recommended.description}
                  </p>

                  <div className="grid grid-cols-3 gap-2.5 mb-6">
                    {[
                      { label: 'Duration', value: `${recommendation.plan.weeks} wks` },
                      { label: 'Per week', value: `${recommendation.plan.lessonsPerWeek} lessons` },
                      { label: 'Your pace', value: `${recommendation.plan.weeklyHours} h/wk` },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl bg-white/[0.045] border border-white/[0.07] px-3 py-2.5 text-center">
                        <p className="text-base font-bold text-white font-display">{s.value}</p>
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                      Why this path for you
                    </p>
                    <ul className="space-y-2">
                      {recommendation.reasons.map((r, i) => (
                        <motion.li
                          key={r}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.15 + i * 0.08 }}
                          className="flex gap-2.5 text-[13px] text-slate-300 leading-relaxed"
                        >
                          <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                          {r}
                        </motion.li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-orbit-violet/25 bg-orbit-violet/[0.07] px-4 py-3 mb-6">
                    <p className="text-[13px] text-violet-100/90 leading-relaxed">{recommendation.plan.note}</p>
                  </div>

                  {recommendation.recommended.outcomes?.length > 0 && (
                    <div className="mb-6">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                        What you will be able to do
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {recommendation.recommended.outcomes.map((o) => (
                          <span key={o} className="chip-cyan">{o}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <button onClick={startPath} disabled={busy} className="btn-primary w-full py-3 text-base">
                    {busy ? <><Spinner size={16} /> Building your orbit…</> : <>Start this path <Rocket size={17} /></>}
                  </button>
                </div>
              </div>

              {recommendation.alternatives?.length > 0 && (
                <div className="glass p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Considered but not chosen
                  </p>
                  <div className="space-y-2">
                    {recommendation.alternatives.map((a) => (
                      <div key={a.path._id} className="rounded-xl bg-white/[0.03] border border-white/[0.07] px-3.5 py-3">
                        <p className="text-[13px] font-semibold text-slate-200">{a.path.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{a.whyNotPrimary}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-3">
                    You can switch to any of these later from the Path Navigator — completed topics carry over.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* nav buttons */}
        {step < 4 && (
          <div className="flex items-center justify-between gap-3 mt-6">
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1 || busy}
              className="btn-secondary"
            >
              <ArrowLeft size={15} /> Back
            </button>
            <button onClick={next} disabled={busy} className="btn-primary px-6">
              {busy ? (
                <><Spinner size={15} /> Finding your path…</>
              ) : step === 3 ? (
                <>Get my path <Sparkles size={16} /></>
              ) : (
                <>Continue <ArrowRight size={15} /></>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
