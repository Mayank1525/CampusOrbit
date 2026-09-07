import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, Search, Filter, X, Bookmark, SlidersHorizontal, TrendingUp,
  CheckCircle2, AlertCircle, Building2, Zap, GraduationCap, Award, FileText, Info, RotateCcw,
} from 'lucide-react';
import { opportunityAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import OpportunityCard from '../components/OpportunityCard';
import {
  PageHeader, LoadingScreen, EmptyState, Badge, MotionCard, Tabs, Spinner, Callout, StatCard,
} from '../components/ui/Primitives';
import { Drawer } from '../components/ui/Modal';

const TYPES = [
  { key: '', label: 'All types', icon: Filter },
  { key: 'placement', label: 'Placement', icon: Briefcase },
  { key: 'internship', label: 'Internship', icon: GraduationCap },
  { key: 'hackathon', label: 'Hackathon', icon: Zap },
  { key: 'scholarship', label: 'Scholarship', icon: Award },
  { key: 'exam', label: 'Exam', icon: FileText },
];

export default function Opportunities() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState({ opportunities: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState('all');
  const [bookmarks, setBookmarks] = useState([]);

  const [filters, setFilters] = useState({
    search: '',
    type: '',
    company: '',
    skill: '',
    location: '',
    sort: 'deadline',
    includeExpired: 'false',
  });

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const d = await opportunityAPI.list({ ...params, limit: 48 });
      setData(d);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(() => load(), filters.search ? 400 : 0);
    return () => clearTimeout(t);
  }, [load, filters.search]);

  useEffect(() => {
    opportunityAPI.bookmarks().then((d) => setBookmarks(d.opportunities || [])).catch(() => {});
  }, []);

  const toggleBookmark = async (o) => {
    try {
      const d = await opportunityAPI.toggleBookmark(o._id);
      toast.success(d.bookmarked ? 'Bookmarked' : 'Bookmark removed');
      setData((prev) => ({
        ...prev,
        opportunities: prev.opportunities.map((x) =>
          String(x._id) === String(o._id) ? { ...x, bookmarked: d.bookmarked } : x
        ),
      }));
      const bm = await opportunityAPI.bookmarks();
      setBookmarks(bm.opportunities || []);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const reset = () => {
    setFilters({ search: '', type: '', company: '', skill: '', location: '', sort: 'deadline', includeExpired: 'false' });
  };

  const activeFilterCount = Object.entries(filters).filter(
    ([k, v]) => v && !['sort', 'includeExpired'].includes(k)
  ).length;

  if (loading) return <LoadingScreen label="Loading the placement hub…" />;

  const all = data.opportunities;
  const eligible = all.filter((o) => o.eligibilityResult?.eligible);
  const notEligible = all.filter((o) => o.eligibilityResult && !o.eligibilityResult.eligible);
  const applied = all.filter((o) => o.application);

  const shown =
    view === 'eligible' ? eligible :
    view === 'bookmarked' ? all.filter((o) => o.bookmarked) :
    view === 'applied' ? applied :
    all;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Briefcase}
        title="Placement Hub"
        subtitle="Every drive, internship, hackathon, scholarship and exam your college has posted — with eligibility explained in plain English."
        action={
          <>
            <button onClick={() => setFiltersOpen(true)} className="btn-secondary relative">
              <SlidersHorizontal size={15} /> Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-orbit-violet text-[10px] font-bold text-white flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <Link to="/applications" className="btn-primary">
              <TrendingUp size={15} /> My pipeline
            </Link>
          </>
        }
      />

      {/* stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Briefcase} label="Open now" value={all.length} sub="Published & not expired" tone="violet" />
        <StatCard icon={CheckCircle2} label="You're eligible" value={eligible.length} sub="Every rule passes" tone="mint" delay={0.06} />
        <StatCard icon={Bookmark} label="Bookmarked" value={bookmarks.length} sub="Saved for later" tone="amber" delay={0.12} onClick={() => setView('bookmarked')} />
        <StatCard icon={TrendingUp} label="Applied" value={applied.length} sub="In your pipeline" tone="cyan" delay={0.18} onClick={() => setView('applied')} />
      </div>

      {/* search + type tabs */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            className="input pl-11 pr-11 py-3"
            placeholder="Search by role, company, skill or keyword…"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
          {refreshing && <Spinner size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-orbit-cyan" />}
          {filters.search && !refreshing && (
            <button
              onClick={() => setFilters((f) => ({ ...f, search: '' }))}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilters((f) => ({ ...f, type: t.key }))}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
                  filters.type === t.key
                    ? 'border-orbit-violet/50 bg-orbit-violet/15 text-white'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:text-slate-200'
                }`}
              >
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <select
            className="input py-2 w-auto text-[13px]"
            value={filters.sort}
            onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}
            aria-label="Sort opportunities"
          >
            <option value="deadline">Closing soonest</option>
            <option value="newest">Newest first</option>
            <option value="company">Company A–Z</option>
          </select>
        </div>

        <Tabs
          tabs={[
            { key: 'all', label: 'All', count: all.length },
            { key: 'eligible', label: 'Eligible for me', icon: CheckCircle2, count: eligible.length },
            { key: 'bookmarked', label: 'Bookmarked', icon: Bookmark, count: all.filter((o) => o.bookmarked).length },
            { key: 'applied', label: 'Applied', count: applied.length },
          ]}
          active={view}
          onChange={setView}
        />
      </div>

      {/* ineligible explainer */}
      {view === 'all' && notEligible.length > 0 && (
        <Callout tone="cyan" icon={Info} title={`${notEligible.length} drive${notEligible.length === 1 ? '' : 's'} you cannot apply to yet`}>
          CampusOrbit still shows them, with the exact rule you miss. Hiding them would leave you guessing —
          knowing you need 7.0 CGPA instead of 6.1 is actionable information.
        </Callout>
      )}

      {/* grid */}
      {shown.length === 0 ? (
        <MotionCard hover={false} className="p-8">
          <EmptyState
            icon={Briefcase}
            title={activeFilterCount ? 'No opportunities match your filters' : 'No open opportunities right now'}
            description={
              activeFilterCount
                ? 'Try widening your search or clearing filters.'
                : 'When your placement cell publishes a drive it appears here instantly.'
            }
            action={
              activeFilterCount ? (
                <button onClick={reset} className="btn-secondary"><RotateCcw size={15} /> Clear filters</button>
              ) : null
            }
          />
        </MotionCard>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {shown.map((o, i) => (
              <OpportunityCard key={o._id} opportunity={o} onToggleBookmark={toggleBookmark} index={i} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ------------------------------------------------- filter drawer */}
      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter opportunities"
        subtitle={`${data.total} total in the database`}
        width="max-w-md"
        footer={
          <>
            <button className="btn-secondary" onClick={reset}>
              <RotateCcw size={14} /> Reset
            </button>
            <button className="btn-primary" onClick={() => setFiltersOpen(false)}>
              Show {shown.length} results
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="label" htmlFor="fcompany">Company</label>
            <div className="relative">
              <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                id="fcompany"
                className="input pl-10"
                placeholder="e.g. Nexora"
                value={filters.company}
                onChange={(e) => setFilters((f) => ({ ...f, company: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="fskill">Required skill</label>
            <input
              id="fskill"
              className="input"
              placeholder="e.g. React, DSA, SQL"
              value={filters.skill}
              onChange={(e) => setFilters((f) => ({ ...f, skill: e.target.value }))}
            />
          </div>

          <div>
            <label className="label" htmlFor="flocation">Location</label>
            <input
              id="flocation"
              className="input"
              placeholder="e.g. Bengaluru, Remote"
              value={filters.location}
              onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
            />
          </div>

          <div>
            <span className="label">Type</span>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setFilters((f) => ({ ...f, type: t.key }))}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium border transition-all ${
                    filters.type === t.key
                      ? 'border-orbit-violet/50 bg-orbit-violet/12 text-white'
                      : 'border-white/10 text-slate-400 hover:border-white/25'
                  }`}
                >
                  <t.icon size={13} /> {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label">Include closed drives</span>
            <div className="flex gap-2">
              {[{ v: 'false', l: 'Open only' }, { v: 'true', l: 'Include expired' }].map((o) => (
                <button
                  key={o.v}
                  onClick={() => setFilters((f) => ({ ...f, includeExpired: o.v }))}
                  className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-medium border transition-all ${
                    filters.includeExpired === o.v
                      ? 'border-orbit-cyan/50 bg-cyan-400/12 text-white'
                      : 'border-white/10 text-slate-400 hover:border-white/25'
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          <Callout tone="violet" icon={AlertCircle} title="Your eligibility comes from your profile">
            CGPA {user?.profile?.cgpa ?? 'not set'} · {user?.profile?.branch || 'branch not set'} ·{' '}
            {user?.profile?.graduationYear || 'year not set'} · {user?.profile?.backlogCount ?? 0} backlog(s).
            <Link to="/profile" className="block mt-1.5 underline font-semibold">Update profile →</Link>
          </Callout>
        </div>
      </Drawer>
    </div>
  );
}
