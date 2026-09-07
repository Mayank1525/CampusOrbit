import { useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Orbit, Mail, Lock, ArrowRight, Eye, EyeOff, Zap, GraduationCap, Shield, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import StarField, { AuroraBlobs } from '../../components/three/StarField';
import { Spinner } from '../../components/ui/Primitives';

const DEMO_ACCOUNTS = [
  {
    role: 'Student',
    email: 'student@campusorbit.dev',
    password: 'Student@123',
    name: 'Aarav Sharma',
    detail: 'CSE 2026 · active MERN path · 2 resumes',
    icon: GraduationCap,
    tone: 'violet',
  },
  {
    role: 'Placement Cell',
    email: 'admin@campusorbit.dev',
    password: 'Admin@123',
    name: 'Placement Office',
    detail: 'Full admin CRUD, applicants, analytics',
    icon: Shield,
    tone: 'coral',
  },
  {
    role: 'Senior / Alumni',
    email: 'senior@campusorbit.dev',
    password: 'Senior@123',
    name: 'Ishita Verma',
    detail: 'Room moderator · can host Watch Together',
    icon: Users,
    tone: 'amber',
  },
];

const TONES = {
  violet: 'border-orbit-violet/25 hover:border-orbit-violet/55 text-orbit-violet bg-orbit-violet/[0.07]',
  coral: 'border-rose-400/25 hover:border-rose-400/55 text-rose-300 bg-rose-400/[0.07]',
  amber: 'border-amber-400/25 hover:border-amber-400/55 text-amber-300 bg-amber-400/[0.07]',
};

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const submittingRef = useRef(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { email: '', password: '' } });

  const onSubmit = async (values) => {
    // Ref guard: `isSubmitting` updates asynchronously, so a fast double-click
    // (or an Enter keypress landing on an already-submitting form) can fire twice.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setServerError('');
    try {
      const user = await login(values);
      toast.success(`Welcome back, ${user.fullName.split(' ')[0]}!`);
      const from = location.state?.from;
      if (user.role === 'student' && !user.onboardingCompleted) navigate('/onboarding', { replace: true });
      else navigate(from || (user.role === 'admin' ? '/admin' : '/dashboard'), { replace: true });
    } catch (e) {
      setServerError(e.message);
    } finally {
      submittingRef.current = false;
    }
  };

  const routeAfterAuth = (user) => {
    const from = location.state?.from;
    if (user.role === 'student' && !user.onboardingCompleted) {
      navigate('/onboarding', { replace: true });
    } else {
      navigate(from || (user.role === 'admin' ? '/admin' : '/dashboard'), { replace: true });
    }
  };

  const fillDemo = (acc) => {
    setValue('email', acc.email, { shouldValidate: true });
    setValue('password', acc.password, { shouldValidate: true });
    toast.info(`${acc.role} credentials filled — press Sign in`);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6">
      <StarField density={0.00018} />
      <AuroraBlobs />

      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        className="relative z-10 w-full max-w-5xl grid lg:grid-cols-[1fr_0.85fr] gap-5"
      >
        {/* ------------------------------------------------------- form */}
        <div className="gradient-border p-7 sm:p-9">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-7 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orbit-violet to-orbit-indigo flex items-center justify-center border border-white/15 group-hover:scale-105 transition-transform">
              <Orbit size={20} className="text-white" />
            </div>
            <span className="text-lg font-bold text-white font-display">
              Campus<span className="text-gradient">Orbit</span>
            </span>
          </Link>

          <h1 className="text-2xl sm:text-3xl font-bold text-white font-display mb-1.5">Welcome back</h1>
          <p className="text-sm text-slate-400 mb-7">
            Sign in to pick up exactly where your orbit left off.
          </p>

          {serverError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
            >
              {serverError}
            </motion.div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label className="label" htmlFor="email">Email address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="input pl-10"
                  placeholder="you@college.edu"
                  aria-invalid={Boolean(errors.email)}
                  {...register('email', {
                    required: 'Email is required',
                    pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' },
                  })}
                />
              </div>
              {errors.email && <p className="field-error">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="input pl-10 pr-11"
                  placeholder="••••••••"
                  aria-invalid={Boolean(errors.password)}
                  {...register('password', { required: 'Password is required' })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="field-error">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 mt-2">
              {isSubmitting ? (
                <>
                  <Spinner size={16} /> Signing in…
                </>
              ) : (
                <>
                  Sign in <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="text-sm text-slate-400 mt-6 text-center">
            New here?{' '}
            <Link to="/register" className="text-orbit-cyan font-semibold hover:underline">
              Create your account
            </Link>
          </p>
        </div>

        {/* ------------------------------------------------ demo accounts */}
        <div className="glass p-6 sm:p-7 flex flex-col">
          <div className="flex items-center gap-2 mb-1.5">
            <Zap size={16} className="text-orbit-cyan" />
            <h2 className="text-base font-bold text-white font-display">Demo accounts</h2>
          </div>
          <p className="text-xs text-slate-400 mb-5 leading-relaxed">
            Seeded with real data in MongoDB. Click a card to fill the form — everything you do persists.
          </p>

          <div className="space-y-3 flex-1">
            {DEMO_ACCOUNTS.map((acc, i) => (
              <motion.button
                key={acc.email}
                type="button"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 + i * 0.09 }}
                whileHover={{ x: 3 }}
                onClick={() => fillDemo(acc)}
                className={`w-full text-left rounded-xl border p-3.5 transition-all ${TONES[acc.tone]}`}
              >
                <div className="flex items-start gap-3">
                  <acc.icon size={17} className="shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-white">{acc.role}</p>
                    <p className="text-[11px] text-slate-400 truncate">{acc.name} — {acc.detail}</p>
                    <p className="text-[10px] font-mono text-slate-500 mt-1.5 truncate">
                      {acc.email} · {acc.password}
                    </p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-white/[0.07]">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Extra seeded students: <code className="text-slate-400">rohan@</code>,{' '}
              <code className="text-slate-400">sneha@</code>,{' '}
              <code className="text-slate-400">karan@campusorbit.dev</code> (all{' '}
              <code className="text-slate-400">Student@123</code>). Karan has 6.1 CGPA and 2 backlogs — use him to
              see the eligibility engine explain a rejection.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
