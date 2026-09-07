import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Orbit, Home, ArrowLeft } from 'lucide-react';
import StarField from '../components/three/StarField';

export default function NotFound() {
  return (
    <div className="min-h-screen relative flex items-center justify-center p-6">
      <StarField density={0.0002} />
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        className="relative z-10 text-center max-w-md"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
          className="w-20 h-20 mx-auto mb-7 rounded-full border-2 border-dashed border-orbit-violet/35 flex items-center justify-center"
        >
          <Orbit size={32} className="text-orbit-violet" />
        </motion.div>
        <h1 className="text-6xl font-bold text-gradient font-display mb-3">404</h1>
        <h2 className="text-xl font-bold text-white font-display mb-2">This page left orbit</h2>
        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
          The route you asked for does not exist. It may have been moved, or the link is out of date.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button onClick={() => window.history.back()} className="btn-secondary">
            <ArrowLeft size={15} /> Go back
          </button>
          <Link to="/dashboard" className="btn-primary">
            <Home size={15} /> Dashboard
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
