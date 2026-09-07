import { useRef, useMemo, useState, Suspense, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line, Stars, Float } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, CheckCircle2, Zap, Loader2, Maximize2, RotateCcw, Info } from 'lucide-react';
import { prefersReducedMotion } from '../../utils/helpers';

/* -------------------------------------------------------------- palette */
const STATUS = {
  completed: {
    color: '#34d399',
    emissive: '#10b981',
    glow: 1.35,
    label: 'Completed',
    ring: '#22d3ee',
  },
  'in-progress': {
    color: '#7c5cff',
    emissive: '#7c5cff',
    glow: 1.6,
    label: 'In progress',
    ring: '#a78bfa',
  },
  current: {
    color: '#8b6dff',
    emissive: '#7c5cff',
    glow: 1.8,
    label: 'Current focus',
    ring: '#c4b5fd',
  },
  locked: {
    color: '#6b74a3',
    emissive: '#39406e',
    glow: 0.55,
    label: 'Locked',
    ring: '#4a5286',
  },
};

/* ------------------------------------------------------- central "sun" */
function CoreStar({ accentColor = '#7c5cff', percent = 0 }) {
  const meshRef = useRef();
  const haloRef = useRef();

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.18;
      meshRef.current.rotation.x += delta * 0.06;
    }
    if (haloRef.current) {
      const t = state.clock.elapsedTime;
      const s = 1 + Math.sin(t * 1.4) * 0.05;
      haloRef.current.scale.setScalar(s);
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[0.92, 2]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={1.5}
          roughness={0.24}
          metalness={0.7}
          wireframe
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.62, 32, 32]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={2.4}
          roughness={0.1}
          metalness={0.2}
        />
      </mesh>
      <mesh ref={haloRef}>
        <sphereGeometry args={[1.25, 32, 32]} />
        <meshBasicMaterial color={accentColor} transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
      <pointLight position={[0, 0, 0]} intensity={3.2} distance={22} color={accentColor} />
      <Html center distanceFactor={11} zIndexRange={[10, 0]}>
        <div className="pointer-events-none select-none text-center">
          <div className="text-[30px] font-bold text-white leading-none font-display drop-shadow-[0_0_10px_rgba(124,92,255,0.9)] tabular-nums">
            {percent}%
          </div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-slate-300/90 mt-1">path done</div>
        </div>
      </Html>
    </group>
  );
}

/* ------------------------------------------------------- orbit ellipse */
function OrbitRing({ radius, color = '#7c5cff', opacity = 0.16, tilt = 0 }) {
  const points = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 128; i += 1) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    return pts;
  }, [radius]);

  return (
    <group rotation={[tilt, 0, 0]}>
      <Line points={points} color={color} lineWidth={1} transparent opacity={opacity} />
    </group>
  );
}

/* ------------------------------------------------------- milestone node */
function MilestoneNode({ node, index, total, onSelect, onHover, isSelected, reduced }) {
  const groupRef = useRef();
  const meshRef = useRef();
  const ringRef = useRef();
  const [hovered, setHovered] = useState(false);

  const cfg = STATUS[node.status] || STATUS.locked;

  // Deterministic layout: spiral outward so later milestones sit further out.
  const layout = useMemo(() => {
    const cfgOrbit = node.orbitConfig || {};
    const angle = cfgOrbit.angle ?? (index / Math.max(1, total)) * Math.PI * 2;
    const radius = cfgOrbit.radius ?? 2.6 + index * 0.52;
    const height = cfgOrbit.height ?? Math.sin(index * 1.1) * 0.72;
    return { angle, radius, height, speed: 0.06 / (1 + index * 0.14) };
  }, [node.orbitConfig, index, total]);

  useFrame((state) => {
    const t = reduced ? 0 : state.clock.elapsedTime;
    const a = layout.angle + t * layout.speed;
    if (groupRef.current) {
      groupRef.current.position.set(
        Math.cos(a) * layout.radius,
        layout.height + (reduced ? 0 : Math.sin(t * 0.7 + index) * 0.1),
        Math.sin(a) * layout.radius
      );
    }
    if (meshRef.current) {
      meshRef.current.rotation.y += reduced ? 0 : 0.006;
      const target = hovered || isSelected ? 1.32 : 1;
      meshRef.current.scale.lerp(new THREE.Vector3(target, target, target), 0.14);
    }
    // Pulsing halo for the current milestone
    if (ringRef.current && (node.status === 'current' || node.status === 'in-progress')) {
      const p = reduced ? 1.35 : 1.2 + Math.sin(t * 2.1) * 0.28;
      ringRef.current.scale.setScalar(p);
      ringRef.current.material.opacity = reduced ? 0.3 : 0.22 + Math.sin(t * 2.1) * 0.16;
    }
  });

  const size = node.status === 'locked' ? 0.235 : 0.28;

  return (
    <group ref={groupRef}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHover?.(node);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
          onHover?.(null);
          document.body.style.cursor = 'auto';
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(node);
        }}
      >
        {node.status === 'completed' ? (
          <octahedronGeometry args={[size * 1.15, 0]} />
        ) : (
          <sphereGeometry args={[size, 24, 24]} />
        )}
        <meshStandardMaterial
          color={cfg.color}
          emissive={cfg.emissive}
          emissiveIntensity={hovered ? cfg.glow * 1.5 : cfg.glow}
          roughness={node.status === 'locked' ? 0.55 : 0.22}
          metalness={node.status === 'locked' ? 0.35 : 0.68}
          transparent
          opacity={node.status === 'locked' ? 0.9 : 1}
        />
      </mesh>

      {/* Pulse ring for current milestone */}
      {(node.status === 'current' || node.status === 'in-progress') && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size * 1.6, size * 1.95, 48]} />
          <meshBasicMaterial color={cfg.ring} transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      )}

      {node.status !== 'locked' && <pointLight intensity={0.55} distance={2.4} color={cfg.color} />}

      {/* Always-visible tiny order label */}
      <Html center distanceFactor={14} zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
        <div
          className="text-[10px] font-bold tabular-nums select-none"
          style={{ color: node.status === 'locked' ? '#98a0c8' : cfg.color, textShadow: '0 0 8px rgba(0,0,0,0.9)' }}
        >
          {node.order}
        </div>
      </Html>

      {/* Rich hover tooltip */}
      {hovered && (
        <Html center distanceFactor={9} zIndexRange={[60, 0]} style={{ pointerEvents: 'none' }}>
          <div className="w-64 -translate-y-24 rounded-xl border border-white/15 bg-space-950/95 backdrop-blur-xl p-3 shadow-elevate">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <p className="text-[13px] font-bold text-white leading-tight">{node.title}</p>
              <span
                className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                style={{ color: cfg.color, background: `${cfg.color}22`, border: `1px solid ${cfg.color}44` }}
              >
                {cfg.label}
              </span>
            </div>
            {node.whyItMatters && (
              <p className="text-[11px] text-slate-400 leading-snug line-clamp-3 mb-2">{node.whyItMatters}</p>
            )}
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>
                {node.lessonsCompleted}/{node.lessonCount} lessons
              </span>
              <span>{node.estimatedHours}h est.</span>
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${node.percent}%`, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.ring})` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-2">Click to open milestone detail →</p>
          </div>
        </Html>
      )}
    </group>
  );
}

/* -------------------------------------------------- connection trails */
function ProgressTrail({ nodes, reduced }) {
  const ref = useRef();
  const completedCount = nodes.filter((n) => n.status === 'completed').length;

  useFrame((state) => {
    if (ref.current && !reduced) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
  });

  const pts = useMemo(() => {
    const out = [];
    for (let i = 0; i <= 200; i += 1) {
      const t = i / 200;
      const maxT = Math.max(0.02, completedCount / Math.max(1, nodes.length));
      if (t > maxT) break;
      const a = t * Math.PI * 2 * (nodes.length / 4);
      const r = 2.6 + t * nodes.length * 0.52;
      out.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(t * nodes.length * 1.1) * 0.72, Math.sin(a) * r));
    }
    return out.length > 1 ? out : null;
  }, [nodes.length, completedCount]);

  if (!pts) return null;
  return (
    <group ref={ref}>
      <Line points={pts} color="#22d3ee" lineWidth={1.6} transparent opacity={0.32} />
    </group>
  );
}

/* ------------------------------------------------------------- camera */
function SceneRig({ reduced }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 5.2, 9.5);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  useFrame((state) => {
    if (reduced) return;
    // gentle parallax with pointer
    const x = state.pointer.x * 0.35;
    const y = state.pointer.y * 0.25;
    camera.position.x += (x * 2 - camera.position.x * 0.02) * 0.008;
    camera.position.y += (5.2 + y * 1.4 - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/* ---------------------------------------------------------- main scene */
function OrbitScene({ nodes, accentColor, percent, onSelect, selectedId, reduced }) {
  const [, setHovered] = useState(null);
  const radii = useMemo(() => nodes.map((_, i) => 2.6 + i * 0.52), [nodes]);

  return (
    <>
      <ambientLight intensity={0.42} />
      <directionalLight position={[6, 8, 5]} intensity={0.55} color="#a5b4fc" />
      <directionalLight position={[-6, -3, -5]} intensity={0.24} color="#22d3ee" />

      {!reduced && <Stars radius={60} depth={40} count={1400} factor={3.2} saturation={0} fade speed={0.4} />}

      <Float speed={reduced ? 0 : 1.1} rotationIntensity={reduced ? 0 : 0.14} floatIntensity={reduced ? 0 : 0.28}>
        <CoreStar accentColor={accentColor} percent={percent} />
      </Float>

      {radii.map((r, i) => (
        <OrbitRing
          key={r}
          radius={r}
          color={nodes[i]?.status === 'completed' ? '#22d3ee' : accentColor}
          opacity={nodes[i]?.status === 'locked' ? 0.13 : 0.2}
        />
      ))}

      <ProgressTrail nodes={nodes} reduced={reduced} />

      {nodes.map((n, i) => (
        <MilestoneNode
          key={n._id}
          node={n}
          index={i}
          total={nodes.length}
          onSelect={onSelect}
          onHover={setHovered}
          isSelected={selectedId === n._id}
          reduced={reduced}
        />
      ))}

      <SceneRig reduced={reduced} />
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={5}
        maxDistance={20}
        maxPolarAngle={Math.PI / 1.75}
        minPolarAngle={0.28}
        autoRotate={!reduced}
        autoRotateSpeed={0.32}
        dampingFactor={0.08}
        enableDamping
      />
    </>
  );
}

/* ------------------------------------------------------------- wrapper */
export default function LearningOrbit({
  nodes = [],
  accentColor = '#7c5cff',
  percent = 0,
  onSelectMilestone,
  selectedId,
  height = 460,
  className = '',
}) {
  const [reduced] = useState(() => prefersReducedMotion());
  const [resetKey, setResetKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const legend = [
    { label: 'Completed', color: '#34d399' },
    { label: 'Current', color: '#7c5cff' },
    { label: 'Locked', color: '#3a4165' },
  ];

  if (!nodes.length) {
    return (
      <div
        className="glass flex flex-col items-center justify-center gap-3 text-center px-6"
        style={{ height }}
      >
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orbit-violet/20 to-orbit-cyan/12 border border-white/10 flex items-center justify-center">
          <Zap size={22} className="text-orbit-violet" />
        </div>
        <p className="text-sm text-slate-300 font-medium">No orbit yet</p>
        <p className="text-xs text-slate-500 max-w-xs">
          Pick a learning path in the Path Navigator and your 3D milestone orbit will appear here.
        </p>
      </div>
    );
  }

  const body = (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/[0.09] bg-gradient-to-b from-space-900/70 to-space-950/90 ${className}`}
      style={{ height: fullscreen ? '100%' : height }}
    >
      <Canvas
        key={resetKey}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 5.2, 9.5], fov: 52 }}
      >
        <Suspense fallback={null}>
          <OrbitScene
            nodes={nodes}
            accentColor={accentColor}
            percent={percent}
            onSelect={onSelectMilestone}
            selectedId={selectedId}
            reduced={reduced}
          />
        </Suspense>
      </Canvas>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3 rounded-lg bg-space-950/75 backdrop-blur px-3 py-2 border border-white/[0.08] pointer-events-none">
        {legend.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5 text-[10px] text-slate-300">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: l.color, boxShadow: `0 0 6px ${l.color}` }}
            />
            {l.label}
          </span>
        ))}
      </div>

      {/* Controls */}
      <div className="absolute top-3 right-3 flex gap-1.5">
        <button
          onClick={() => setResetKey((k) => k + 1)}
          title="Reset camera"
          aria-label="Reset camera view"
          className="p-2 rounded-lg bg-space-950/75 backdrop-blur border border-white/[0.08] text-slate-300 hover:text-white hover:border-orbit-violet/40 transition-colors"
        >
          <RotateCcw size={14} />
        </button>
        <button
          onClick={() => setFullscreen((f) => !f)}
          title={fullscreen ? 'Exit fullscreen' : 'Expand orbit'}
          aria-label={fullscreen ? 'Exit fullscreen' : 'Expand orbit'}
          className="p-2 rounded-lg bg-space-950/75 backdrop-blur border border-white/[0.08] text-slate-300 hover:text-white hover:border-orbit-violet/40 transition-colors"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      <div className="absolute top-3 left-3 pointer-events-none">
        <span className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-space-950/70 backdrop-blur px-2.5 py-1.5 rounded-lg border border-white/[0.08]">
          <Info size={11} />
          Drag to rotate · scroll to zoom · click a node
        </span>
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[160] bg-space-950 p-3 sm:p-6"
        >
          <div className="w-full h-full">{body}</div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return body;
}

/* ------------------------------------------- lightweight 2D fallback list */
export function OrbitNodeList({ nodes, onSelect, selectedId }) {
  return (
    <div className="space-y-2">
      {nodes.map((n) => {
        const cfg = STATUS[n.status] || STATUS.locked;
        const Icon = n.status === 'completed' ? CheckCircle2 : n.status === 'locked' ? Lock : Zap;
        return (
          <button
            key={n._id}
            onClick={() => onSelect?.(n)}
            className={`w-full text-left flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-all ${
              selectedId === n._id
                ? 'border-orbit-violet/50 bg-orbit-violet/10'
                : 'border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/15'
            }`}
          >
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${cfg.color}1f`, color: cfg.color, border: `1px solid ${cfg.color}44` }}
            >
              <Icon size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-100 truncate">
                {n.order}. {n.title}
              </span>
              <span className="block text-[11px] text-slate-400">
                {cfg.label} · {n.lessonsCompleted}/{n.lessonCount} lessons
              </span>
            </span>
            <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: cfg.color }}>
              {n.percent}%
            </span>
          </button>
        );
      })}
    </div>
  );
}
