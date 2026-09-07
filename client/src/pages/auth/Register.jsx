import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Orbit, Mail, Lock, User, ArrowRight, Eye, EyeOff, GraduationCap, Users, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import StarField, { AuroraBlobs } from '../../components/three/StarField';
import { Spinner } from '../../components/ui/Primitives';

const ROLES = [
  {
    value: 'student',
    label: 'Student',
    icon: GraduationCap,
    body: 'Follow a guided path, prepare for drives, build your resume and apply.',
  },
  {
    value: 'senior',
    label: 'Senior / Alumni',
    icon: Users,
    body: 'Mentor juniors, moderate peer rooms and host Watch Together sessions.',
  },
];

export default function Register() {
  const { register: signup } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('student');
  const [serverError, setServerError] = useState('');
  const submittingRef = useRef(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm();

  const password = watch('password', '');
  const strength = [
    password.length >= 6,
    password.length >= 10,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const strengthMeta = [
    { label: '', color: '' },
    { label: 'Weak', color: 'bg-rose-500' },
    { label: 'Fair', color: 'bg-orange-400' },
    { label: 'Good', color: 'bg-amber-400' },
    { label: 'Strong', color: 'bg-emerald-400' },
    { label: 'Excellent', color: 'bg-emerald-400' },
  ][strength];

  const onSubmit = async (values) => {
    // Ref guard: `isSubmitting` updates asynchronously, so a fast double-click
    // (or an Enter keypress landing on an already-submitting form) can fire twice.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setServerError('');
    try {
      const user = await signup({ ...values, role });
      toast.success(`Account created. Welcome, ${user.fullName.split(' ')[0]}!`);
      navigate(user.role === 'student' ? '/onboarding' : '/dashboard', { replace: true });
    } catch (e) {
      setServerError(e.message);
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6">
      <StarField density={0.00018} />
      <AuroraBlobs />

      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        className="relative z-10 w-full max-w-lg gradient-border p-7 sm:p-9"
      >
        <Link to="/" className="inline-flex items-center gap-2.5 mb-6 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orbit-violet to-orbit-indigo flex items-center justify-center border border-white/15 group-hover:scale-105 transition-transform">
            <Orbit size={20} className="text-white" />
          </div>
          <span className="text-lg font-bold text-white font-display">
            Campus<span className="text-gradient">Orbit</span>
          </span>
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold text-white font-display mb-1.5">Create your account</h1>
        <p className="text-sm text-slate-400 mb-6">One path. Three tasks a day. Real placement outcomes.</p>

        {serverError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
          >
            {serverError}
          </motion.div>
        )}

        {/* role picker */}
        <div className="mb-5">
          <span className="label">I am joining as</span>
          <div className="grid grid-cols-2 gap-2.5">
            {ROLES.map((r) => {
              const active = role === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`relative text-left rounded-xl border p-3 transition-all ${
                    active
                      ? 'border-orbit-violet/60 bg-orbit-violet/12 shadow-glow'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                  }`}
                >
                  {active && (
                    <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-orbit-violet flex items-center justify-center">
                      <Check size={10} className="text-white" strokeWidth={3} />
                    </span>
                  )}
                  <r.icon size={17} className={active ? 'text-orbit-violet' : 'text-slate-400'} />
                  <p className="text-[13px] font-bold text-white mt-2">{r.label}</p>
                  <p className="text-[10px] text-slate-400 leading-snug mt-1">{r.body}</p>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Placement Cell (admin) accounts are provisioned by your college, not self-registered.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="fullName">Full name</label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                id="fullName"
                className="input pl-10"
                placeholder="Aarav Sharma"
                autoComplete="name"
                {...register('fullName', {
                  required: 'Full name is required',
                  minLength: { value: 2, message: 'Name must be at least 2 characters' },
                  maxLength: { value: 80, message: 'Name is too long' },
                })}
              />
            </div>
            {errors.fullName && <p className="field-error">{errors.fullName.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="reg-email">Email address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                id="reg-email"
                type="email"
                className="input pl-10"
                placeholder="you@college.edu"
                autoComplete="email"
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' },
                })}
              />
            </div>
            {errors.email && <p className="field-error">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="reg-password">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                className="input pl-10 pr-11"
                placeholder="At least 6 characters"
                autoComplete="new-password"
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 6, message: 'Password must be at least 6 characters' },
                })}
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
            {password && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= strength ? strengthMeta.color : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-slate-400 w-16">{strengthMeta.label}</span>
              </div>
            )}
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 mt-2">
            {isSubmitting ? (
              <>
                <Spinner size={16} /> Creating account…
              </>
            ) : (
              <>
                Create account <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <p className="text-sm text-slate-400 mt-6 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-orbit-cyan font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
