import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Compass, Orbit, PlayCircle, ListVideo, NotebookPen, Briefcase,
  ClipboardList, FileText, FolderLock, MessagesSquare, Mic, BarChart3, Settings,
  Bell, LogOut, Menu, X, ChevronDown, Shield, GraduationCap, Sparkles, Search,
  UserCircle, Wifi, WifiOff, Video,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { notificationAPI } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import StarField from '../components/three/StarField';
import { Avatar, Badge } from '../components/ui/Primitives';
import { timeAgo, classNames } from '../utils/helpers';
import ErrorBoundary from '../components/ErrorBoundary';

/* All 13 student destinations, exactly as specified. */
const STUDENT_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Focus' },
  { to: '/path-navigator', label: 'Path Navigator', icon: Compass, group: 'Focus' },
  { to: '/my-path', label: 'My Path', icon: Orbit, group: 'Focus' },
  { to: '/learn', label: 'Learn', icon: PlayCircle, group: 'Study' },
  { to: '/video-queue', label: 'My Video Queue', icon: ListVideo, group: 'Study' },
  { to: '/notes', label: 'Notes & Revision', icon: NotebookPen, group: 'Study' },
  { to: '/progress', label: 'Progress', icon: BarChart3, group: 'Study' },
  { to: '/opportunities', label: 'Placement Hub', icon: Briefcase, group: 'Career' },
  { to: '/applications', label: 'My Applications', icon: ClipboardList, group: 'Career' },
  { to: '/resume-studio', label: 'Resume Studio', icon: FileText, group: 'Career' },
  { to: '/documents', label: 'Document Wallet', icon: FolderLock, group: 'Career' },
  { to: '/interview-practice', label: 'Interview Practice', icon: Mic, group: 'Career' },
  { to: '/rooms', label: 'Peer Prep Rooms', icon: MessagesSquare, group: 'Community' },
  { to: '/live-sessions', label: 'Live Sessions', icon: Video, group: 'Community' },
];

const ADMIN_NAV = [
  { to: '/admin', label: 'Admin Overview', icon: Shield, group: 'Placement Cell', end: true },
  { to: '/admin/opportunities', label: 'Opportunities', icon: Briefcase, group: 'Placement Cell' },
  { to: '/admin/applicants', label: 'Applicants', icon: ClipboardList, group: 'Placement Cell' },
  { to: '/admin/content', label: 'Learning Content', icon: PlayCircle, group: 'Content' },
  { to: '/admin/ai-review', label: 'AI Review Queue', icon: Sparkles, group: 'Content' },
  { to: '/admin/interview-bank', label: 'Interview Bank', icon: Mic, group: 'Content' },
  { to: '/admin/rooms', label: 'Rooms & Moderation', icon: MessagesSquare, group: 'Moderation' },
  { to: '/admin/students', label: 'Students', icon: GraduationCap, group: 'People' },
  { to: '/admin/announcements', label: 'Announcements', icon: Bell, group: 'People' },
];

const GROUP_ORDER = ['Focus', 'Study', 'Career', 'Community', 'Placement Cell', 'Content', 'People', 'Moderation'];

export default function AppLayout() {
  const { user, logout, isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const { connected } = useSocket(true);
  const notifRef = useRef(null);
  const menuRef = useRef(null);

  const inAdmin = location.pathname.startsWith('/admin');
  const nav = inAdmin && isAdmin ? ADMIN_NAV : STUDENT_NAV;

  const loadNotifications = async () => {
    try {
      const data = await notificationAPI.list({ limit: 12 });
      setNotifications(data.notifications || []);
      setUnread(data.unreadCount ?? 0);
    } catch {
      /* silent — notifications are non-critical */
    }
  };

  useEffect(() => {
    loadNotifications();
    const id = setInterval(loadNotifications, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
    setNotifOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out. See you soon!');
    navigate('/login');
  };

  const markRead = async (n) => {
    if (!n.read) {
      try {
        await notificationAPI.markRead(n._id);
        setNotifications((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
        setUnread((u) => Math.max(0, u - 1));
      } catch { /* ignore */ }
    }
    if (n.link) {
      setNotifOpen(false);
      navigate(n.link);
    }
  };

  const markAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
      setUnread(0);
      toast.success('All notifications marked as read');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const grouped = GROUP_ORDER.map((g) => ({ group: g, items: nav.filter((n) => n.group === g) })).filter(
    (g) => g.items.length
  );

  return (
    <div className="min-h-screen relative">
      <StarField />

      {/* ---------------------------------------------------------- Topbar */}
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-space-950/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-3 sm:px-5 h-16">
          <button
            className="lg:hidden p-2 rounded-lg text-slate-300 hover:bg-white/[0.07]"
            onClick={() => setSidebarOpen((s) => !s)}
            aria-label="Toggle navigation menu"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <Link to={isAdmin ? '/admin' : '/dashboard'} className="flex items-center gap-2.5 shrink-0 group">
            <div className="relative w-9 h-9">
              <motion.div
                className="absolute inset-0 rounded-xl bg-gradient-to-br from-orbit-violet to-orbit-cyan opacity-80 blur-[6px]"
                animate={{ scale: [1, 1.14, 1] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-orbit-violet to-orbit-indigo flex items-center justify-center border border-white/15">
                <Orbit size={19} className="text-white" />
              </div>
            </div>
            <div className="hidden sm:block leading-tight">
              <p className="text-[15px] font-bold text-white font-display tracking-tight">
                Campus<span className="text-gradient">Orbit</span>
              </p>
              <p className="text-[9px] text-slate-500 uppercase tracking-[0.14em]">
                confusion → career-ready
              </p>
            </div>
          </Link>

          <div className="flex-1" />

          {/* Role switcher for admins */}
          {isAdmin && (
            <div className="hidden md:flex items-center gap-1 p-1 rounded-lg bg-space-900/70 border border-white/[0.07]">
              <button
                onClick={() => navigate('/admin')}
                className={classNames(
                  'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors',
                  inAdmin ? 'bg-orbit-violet/25 text-white border border-orbit-violet/35' : 'text-slate-400 hover:text-white'
                )}
              >
                <Shield size={12} className="inline mr-1.5" />
                Placement Cell
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className={classNames(
                  'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors',
                  !inAdmin ? 'bg-orbit-cyan/22 text-white border border-orbit-cyan/35' : 'text-slate-400 hover:text-white'
                )}
              >
                <GraduationCap size={12} className="inline mr-1.5" />
                Student view
              </button>
            </div>
          )}

          {/* Live indicator */}
          <span
            className={classNames(
              'hidden sm:flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border',
              connected
                ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
                : 'text-slate-400 bg-white/[0.04] border-white/10'
            )}
            title={connected ? 'Real-time connection active' : 'Real-time connection offline'}
          >
            {connected ? <Wifi size={11} /> : <WifiOff size={11} />}
            {connected ? 'Live' : 'Offline'}
          </span>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen((o) => !o)}
              className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.07] transition-colors"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
            >
              <Bell size={19} />
              {unread > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 text-[9px] font-bold text-white flex items-center justify-center border border-space-950"
                >
                  {unread > 9 ? '9+' : unread}
                </motion.span>
              )}
            </button>

            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                  className="absolute right-0 mt-2 w-[min(23rem,calc(100vw-1.5rem))] glass-strong overflow-hidden z-50"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
                    <p className="text-sm font-bold text-white">Notifications</p>
                    {unread > 0 && (
                      <button onClick={markAllRead} className="text-[11px] text-orbit-cyan hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-[26rem] overflow-y-auto scrollbar-thin">
                    {notifications.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-10 px-4">
                        No notifications yet. Reminders arrive automatically from the scheduler.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n._id}
                          onClick={() => markRead(n)}
                          className={classNames(
                            'w-full text-left px-4 py-3 border-b border-white/[0.05] last:border-0 hover:bg-white/[0.045] transition-colors flex gap-3',
                            !n.read && 'bg-orbit-violet/[0.07]'
                          )}
                        >
                          <span
                            className={classNames(
                              'w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                              n.read ? 'bg-slate-600' : 'bg-orbit-cyan shadow-glow-cyan'
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-semibold text-slate-100 leading-snug">
                              {n.title}
                            </span>
                            <span className="block text-[11px] text-slate-400 mt-0.5 leading-snug line-clamp-2">
                              {n.body}
                            </span>
                            <span className="block text-[10px] text-slate-500 mt-1">{timeAgo(n.createdAt)}</span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                  <Link
                    to="/notifications"
                    className="block text-center py-2.5 text-xs text-orbit-cyan hover:bg-white/[0.04] border-t border-white/[0.06]"
                  >
                    View all notifications
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              className="flex items-center gap-2 p-1 pr-2 rounded-xl hover:bg-white/[0.07] transition-colors"
              aria-label="Account menu"
            >
              <Avatar name={user?.fullName} color={user?.avatarColor} size={32} />
              <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                  className="absolute right-0 mt-2 w-64 glass-strong overflow-hidden z-50"
                >
                  <div className="px-4 py-3.5 border-b border-white/[0.08]">
                    <p className="text-sm font-bold text-white truncate">{user?.fullName}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                    <div className="mt-2 flex gap-1.5 flex-wrap">
                      <Badge tone={user?.role === 'admin' ? 'coral' : user?.role === 'senior' ? 'amber' : 'violet'}>
                        {user?.role === 'admin' ? 'Placement Cell' : user?.role === 'senior' ? 'Senior / Alumni' : 'Student'}
                      </Badge>
                      {user?.streak?.current > 0 && <Badge tone="mint">🔥 {user.streak.current} day streak</Badge>}
                    </div>
                  </div>
                  <Link to="/profile" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors">
                    <UserCircle size={16} /> My profile
                  </Link>
                  <Link to="/settings" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors">
                    <Settings size={16} /> Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-300 hover:bg-rose-500/12 transition-colors border-t border-white/[0.06]"
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <div className="flex relative">
        {/* -------------------------------------------------------- Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden fixed inset-0 top-16 bg-black/60 backdrop-blur-sm z-30"
            />
          )}
        </AnimatePresence>

        <aside
          className={classNames(
            'fixed lg:sticky top-16 left-0 z-40 w-[248px] shrink-0 h-[calc(100vh-4rem)] overflow-y-auto scrollbar-thin',
            'border-r border-white/[0.07] bg-space-950/92 lg:bg-space-950/45 backdrop-blur-xl transition-transform duration-300',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
        >
          <nav className="px-3 py-4 space-y-5">
            {grouped.map((g) => (
              <div key={g.group}>
                <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  {g.group}
                </p>
                <div className="space-y-0.5">
                  {g.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        classNames(
                          'relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all group',
                          isActive
                            ? 'text-white bg-gradient-to-r from-orbit-violet/22 to-transparent'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.05]'
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <motion.span
                              layoutId="nav-indicator"
                              className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gradient-to-b from-orbit-violet to-orbit-cyan"
                              transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                            />
                          )}
                          <item.icon
                            size={16}
                            className={classNames(
                              'shrink-0 transition-transform group-hover:scale-110',
                              isActive ? 'text-orbit-violet' : ''
                            )}
                          />
                          <span className="truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}

            <div className="pt-3 mt-3 border-t border-white/[0.06] px-1">
              <div className="rounded-xl bg-gradient-to-br from-orbit-violet/12 to-orbit-cyan/[0.06] border border-white/[0.08] p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles size={13} className="text-orbit-cyan" />
                  <p className="text-[11px] font-bold text-white">One path at a time</p>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  CampusOrbit shows at most 3 tasks a day. Finish those, close the laptop, come back tomorrow.
                </p>
              </div>
            </div>
          </nav>
        </aside>

        {/* --------------------------------------------------------- Content */}
        <main className="flex-1 min-w-0 relative z-10">
          <ErrorBoundary key={location.pathname}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] mx-auto"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
