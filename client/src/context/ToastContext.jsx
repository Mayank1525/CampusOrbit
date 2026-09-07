import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const STYLES = {
  success: 'border-emerald-400/35 bg-emerald-500/12 text-emerald-100',
  error: 'border-rose-400/35 bg-rose-500/12 text-rose-100',
  info: 'border-cyan-400/35 bg-cyan-500/12 text-cyan-100',
  warning: 'border-amber-400/35 bg-amber-500/12 text-amber-100',
};

const ICON_COLORS = {
  success: 'text-emerald-400',
  error: 'text-rose-400',
  info: 'text-cyan-400',
  warning: 'text-amber-400',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message, type = 'info', duration = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((t) => [...t.slice(-4), { id, message, type }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const toast = useMemo(
    () => ({
      success: (m, d) => push(m, 'success', d),
      error: (m, d) => push(m, 'error', d ?? 5500),
      info: (m, d) => push(m, 'info', d),
      warning: (m, d) => push(m, 'warning', d),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2.5 w-[min(24rem,calc(100vw-2rem))]"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => {
            const Icon = ICONS[t.type];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 60, scale: 0.94 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 backdrop-blur-xl shadow-elevate ${STYLES[t.type]}`}
              >
                <Icon size={18} className={`shrink-0 mt-0.5 ${ICON_COLORS[t.type]}`} />
                <p className="text-sm flex-1 leading-snug">{t.message}</p>
                <button
                  onClick={() => dismiss(t.id)}
                  className="shrink-0 opacity-55 hover:opacity-100 transition-opacity"
                  aria-label="Dismiss notification"
                >
                  <X size={15} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
