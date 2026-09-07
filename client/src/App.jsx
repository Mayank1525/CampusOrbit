import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';
import { LoadingScreen } from './components/ui/Primitives';

/* Eager: landing + auth (small, first paint matters) */
import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Onboarding from './pages/auth/Onboarding';

/* Lazy: everything behind auth */
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PathNavigator = lazy(() => import('./pages/PathNavigator'));
const MyPath = lazy(() => import('./pages/MyPath'));
const Learn = lazy(() => import('./pages/Learn'));
const LessonDetail = lazy(() => import('./pages/LessonDetail'));
const VideoQueue = lazy(() => import('./pages/VideoQueue'));
const Notes = lazy(() => import('./pages/Notes'));
const Progress = lazy(() => import('./pages/Progress'));
const Opportunities = lazy(() => import('./pages/Opportunities'));
const OpportunityDetail = lazy(() => import('./pages/OpportunityDetail'));
const Applications = lazy(() => import('./pages/Applications'));
const ResumeStudio = lazy(() => import('./pages/ResumeStudio'));
const Documents = lazy(() => import('./pages/Documents'));
const InterviewPractice = lazy(() => import('./pages/InterviewPractice'));
const Rooms = lazy(() => import('./pages/Rooms'));
const LiveSessions = lazy(() => import('./pages/LiveSessions'));
const RoomDetail = lazy(() => import('./pages/RoomDetail'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));

/* Admin */
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'));
const AdminOpportunities = lazy(() => import('./pages/admin/AdminOpportunities'));
const AdminApplicants = lazy(() => import('./pages/admin/AdminApplicants'));
const AdminContent = lazy(() => import('./pages/admin/AdminContent'));
const AdminAIReview = lazy(() => import('./pages/admin/AdminAIReview'));
const AdminInterviewBank = lazy(() => import('./pages/admin/AdminInterviewBank'));
const AdminRooms = lazy(() => import('./pages/admin/AdminRooms'));
const AdminStudents = lazy(() => import('./pages/admin/AdminStudents'));
const AdminAnnouncements = lazy(() => import('./pages/admin/AdminAnnouncements'));

const NotFound = lazy(() => import('./pages/NotFound'));

function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingScreen label="Checking your session…" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  // Students must finish onboarding before entering the app.
  if (
    user.role === 'student' &&
    !user.onboardingCompleted &&
    location.pathname !== '/onboarding'
  ) {
    return <Navigate to="/onboarding" replace />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;

  return children;
}

function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingScreen label="Checking your session…" />
      </div>
    );
  }
  if (isAuthenticated) {
    if (user.role === 'student' && !user.onboardingCompleted) return <Navigate to="/onboarding" replace />;
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }
  return children;
}

const PageFallback = () => (
  <div className="min-h-[55vh] flex items-center justify-center">
    <LoadingScreen />
  </div>
);

export default function App() {
  return (
    <Routes>
      {/* -------------------------------------------------------- public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
      {/* Reset is NOT PublicOnly: the server signs you in mid-flow, and a
          logged-in user following an emailed link must still reach the form. */}
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

      {/* ----------------------------------------------------- app shell */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
        <Route path="/path-navigator" element={<Suspense fallback={<PageFallback />}><PathNavigator /></Suspense>} />
        <Route path="/my-path" element={<Suspense fallback={<PageFallback />}><MyPath /></Suspense>} />
        <Route path="/learn" element={<Suspense fallback={<PageFallback />}><Learn /></Suspense>} />
        <Route path="/learn/:lessonId" element={<Suspense fallback={<PageFallback />}><LessonDetail /></Suspense>} />
        <Route path="/video-queue" element={<Suspense fallback={<PageFallback />}><VideoQueue /></Suspense>} />
        <Route path="/notes" element={<Suspense fallback={<PageFallback />}><Notes /></Suspense>} />
        <Route path="/progress" element={<Suspense fallback={<PageFallback />}><Progress /></Suspense>} />
        <Route path="/opportunities" element={<Suspense fallback={<PageFallback />}><Opportunities /></Suspense>} />
        <Route path="/opportunities/:id" element={<Suspense fallback={<PageFallback />}><OpportunityDetail /></Suspense>} />
        <Route path="/applications" element={<Suspense fallback={<PageFallback />}><Applications /></Suspense>} />
        <Route path="/resume-studio" element={<Suspense fallback={<PageFallback />}><ResumeStudio /></Suspense>} />
        <Route path="/documents" element={<Suspense fallback={<PageFallback />}><Documents /></Suspense>} />
        <Route path="/interview-practice" element={<Suspense fallback={<PageFallback />}><InterviewPractice /></Suspense>} />
        <Route path="/rooms" element={<Suspense fallback={<PageFallback />}><Rooms /></Suspense>} />
        <Route path="/live-sessions" element={<Suspense fallback={<PageFallback />}><LiveSessions /></Suspense>} />
        <Route path="/rooms/:idOrSlug" element={<Suspense fallback={<PageFallback />}><RoomDetail /></Suspense>} />
        <Route path="/notifications" element={<Suspense fallback={<PageFallback />}><Notifications /></Suspense>} />
        <Route path="/profile" element={<Suspense fallback={<PageFallback />}><Profile /></Suspense>} />
        <Route path="/settings" element={<Suspense fallback={<PageFallback />}><Settings /></Suspense>} />

        {/* ------------------------------------------------------- admin */}
        <Route path="/admin" element={<ProtectedRoute roles={['admin']}><Suspense fallback={<PageFallback />}><AdminOverview /></Suspense></ProtectedRoute>} />
        <Route path="/admin/opportunities" element={<ProtectedRoute roles={['admin']}><Suspense fallback={<PageFallback />}><AdminOpportunities /></Suspense></ProtectedRoute>} />
        <Route path="/admin/applicants" element={<ProtectedRoute roles={['admin']}><Suspense fallback={<PageFallback />}><AdminApplicants /></Suspense></ProtectedRoute>} />
        <Route path="/admin/content" element={<ProtectedRoute roles={['admin']}><Suspense fallback={<PageFallback />}><AdminContent /></Suspense></ProtectedRoute>} />
        <Route path="/admin/ai-review" element={<ProtectedRoute roles={['admin']}><Suspense fallback={<PageFallback />}><AdminAIReview /></Suspense></ProtectedRoute>} />
        <Route path="/admin/interview-bank" element={<ProtectedRoute roles={['admin']}><Suspense fallback={<PageFallback />}><AdminInterviewBank /></Suspense></ProtectedRoute>} />
        <Route path="/admin/rooms" element={<ProtectedRoute roles={['admin']}><Suspense fallback={<PageFallback />}><AdminRooms /></Suspense></ProtectedRoute>} />
        <Route path="/admin/students" element={<ProtectedRoute roles={['admin']}><Suspense fallback={<PageFallback />}><AdminStudents /></Suspense></ProtectedRoute>} />
        <Route path="/admin/announcements" element={<ProtectedRoute roles={['admin']}><Suspense fallback={<PageFallback />}><AdminAnnouncements /></Suspense></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Suspense fallback={<PageFallback />}><NotFound /></Suspense>} />
    </Routes>
  );
}
