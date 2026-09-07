import axios from 'axios';

/**
 * Single axios instance. Uses a RELATIVE baseURL so the browser always talks
 * to the same origin it was served from (Vite proxies /api to Express in dev,
 * Express serves the built client in production). Never hardcode localhost.
 */
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Unwrap the consistent { success, message, data } envelope.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const payload = error.response?.data;

    const normalized = new Error(
      payload?.message || error.message || 'Something went wrong. Please try again.'
    );
    normalized.status = status;
    normalized.details = payload?.details || null;
    normalized.isNetwork = !error.response;

    // Session expiry -> bounce to login (except on the auth check itself)
    if (status === 401 && !String(error.config?.url || '').includes('/auth/me')) {
      const path = window.location.pathname;
      if (!['/login', '/register', '/'].includes(path)) {
        window.dispatchEvent(new CustomEvent('co:session-expired'));
      }
    }
    return Promise.reject(normalized);
  }
);

/** Helper that returns response.data.data directly. */
const unwrap = (p) => p.then((r) => r.data.data);

export const authAPI = {
  register: (body) => unwrap(api.post('/auth/register', body)),
  login: (body) => unwrap(api.post('/auth/login', body)),
  logout: () => unwrap(api.post('/auth/logout')),
  me: () => unwrap(api.get('/auth/me')),

};

export const userAPI = {
  updateProfile: (body) => unwrap(api.patch('/users/profile', body)),
  stats: () => unwrap(api.get('/users/stats')),
  list: (params) => unwrap(api.get('/users', { params })),
  toggleActive: (id) => unwrap(api.patch(`/users/${id}/toggle-active`)),
  publicProfile: (id) => unwrap(api.get(`/users/public/${id}`)),
};

export const pathAPI = {
  list: () => unwrap(api.get('/paths')),
  get: (idOrSlug) => unwrap(api.get(`/paths/${idOrSlug}`)),
  recommend: (body) => unwrap(api.post('/paths/recommend', body)),
  start: (pathId, body) => unwrap(api.post(`/paths/${pathId}/start`, body)),
  switch: (pathId) => unwrap(api.post('/paths/switch', { pathId })),
  myProgress: () => unwrap(api.get('/paths/my-progress')),
  milestone: (id) => unwrap(api.get(`/paths/milestone/${id}`)),
  completeMilestone: (id, body) => unwrap(api.post(`/paths/milestone/${id}/complete`, body)),
  // admin
  create: (body) => unwrap(api.post('/paths', body)),
  update: (id, body) => unwrap(api.patch(`/paths/${id}`, body)),
  remove: (id) => unwrap(api.delete(`/paths/${id}`)),
  createMilestone: (body) => unwrap(api.post('/paths/milestones', body)),
  updateMilestone: (id, body) => unwrap(api.patch(`/paths/milestones/${id}`, body)),
  removeMilestone: (id) => unwrap(api.delete(`/paths/milestones/${id}`)),
};

export const lessonAPI = {
  get: (id) => unwrap(api.get(`/lessons/${id}`)),
  saveProgress: (id, body) => unwrap(api.post(`/lessons/${id}/progress`, body)),
  complete: (id) => unwrap(api.post(`/lessons/${id}/complete`)),
  // admin
  listAll: (params) => unwrap(api.get('/lessons', { params })),
  create: (body) => unwrap(api.post('/lessons', body)),
  update: (id, body) => unwrap(api.patch(`/lessons/${id}`, body)),
  remove: (id) => unwrap(api.delete(`/lessons/${id}`)),
};

export const noteAPI = {
  aiStatus: () => unwrap(api.get('/notes/ai-status')),
  mine: () => unwrap(api.get('/notes/mine')),
  createPersonal: (body) => unwrap(api.post('/notes/personal', body)),
  update: (id, body) => unwrap(api.patch(`/notes/${id}`, body)),
  remove: (id) => unwrap(api.delete(`/notes/${id}`)),
  bookmark: (id) => unwrap(api.post(`/notes/${id}/bookmark`)),
  markRevision: (id) => unwrap(api.post(`/notes/${id}/revision`)),
  simplify: (id) => unwrap(api.post(`/notes/${id}/simplify`)),
  highlight: (id, text) => unwrap(api.post(`/notes/${id}/highlight`, { text })),
  // admin
  generate: (lessonId, body) => unwrap(api.post(`/notes/generate/${lessonId}`, body)),
  review: (params) => unwrap(api.get('/notes/review', { params })),
  publish: (id) => unwrap(api.patch(`/notes/${id}/publish`)),
};

export const quizAPI = {
  get: (id) => unwrap(api.get(`/quizzes/${id}`)),
  submit: (id, body) => unwrap(api.post(`/quizzes/${id}/submit`, body)),
  myAttempts: () => unwrap(api.get('/quizzes/attempts/mine')),
  upsert: (body) => unwrap(api.post('/quizzes', body)),
};

export const revisionAPI = {
  list: (params) => unwrap(api.get('/revisions', { params })),
  create: (body) => unwrap(api.post('/revisions', body)),
  complete: (id) => unwrap(api.post(`/revisions/${id}/complete`)),
  reschedule: (id, days) => unwrap(api.post(`/revisions/${id}/reschedule`, { days })),
  skip: (id) => unwrap(api.post(`/revisions/${id}/skip`)),
};

export const videoQueueAPI = {
  list: () => unwrap(api.get('/video-queue')),
  add: (body) => unwrap(api.post('/video-queue', body)),
  validate: (url) => unwrap(api.post('/video-queue/validate', { url })),
  update: (id, body) => unwrap(api.patch(`/video-queue/${id}`, body)),
  bookmark: (id) => unwrap(api.post(`/video-queue/${id}/bookmark`)),
  remove: (id) => unwrap(api.delete(`/video-queue/${id}`)),
};

export const opportunityAPI = {
  list: (params) => unwrap(api.get('/opportunities', { params })),
  get: (id) => unwrap(api.get(`/opportunities/${id}`)),
  matches: (limit) => unwrap(api.get('/opportunities/matches', { params: { limit } })),
  bookmarks: () => unwrap(api.get('/opportunities/bookmarks')),
  toggleBookmark: (id) => unwrap(api.post(`/opportunities/${id}/bookmark`)),
  // admin
  create: (body) => unwrap(api.post('/opportunities', body)),
  update: (id, body) => unwrap(api.patch(`/opportunities/${id}`, body)),
  publish: (id) => unwrap(api.post(`/opportunities/${id}/publish`)),
  expire: (id) => unwrap(api.post(`/opportunities/${id}/expire`)),
  remove: (id) => unwrap(api.delete(`/opportunities/${id}`)),
  eligibleStudents: (id) => unwrap(api.get(`/opportunities/${id}/eligible-students`)),
};

export const applicationAPI = {
  mine: () => unwrap(api.get('/applications/mine')),
  get: (id) => unwrap(api.get(`/applications/${id}`)),
  apply: (body) => unwrap(api.post('/applications', body)),
  updateMyStage: (id, body) => unwrap(api.patch(`/applications/${id}/my-stage`, body)),
  withdraw: (id) => unwrap(api.delete(`/applications/${id}`)),
  // admin
  applicants: (params) => unwrap(api.get('/applications/applicants', { params })),
  updateStage: (id, body) => unwrap(api.patch(`/applications/${id}/stage`, body)),
  adminNote: (id, note) => unwrap(api.patch(`/applications/${id}/admin-note`, { note })),
  exportUrl: (opportunityId) =>
    `/api/applications/export${opportunityId ? `?opportunityId=${opportunityId}` : ''}`,
};

export const resumeAPI = {
  list: () => unwrap(api.get('/resumes')),
  get: (id) => unwrap(api.get(`/resumes/${id}`)),
  create: (body) => unwrap(api.post('/resumes', body)),
  update: (id, body) => unwrap(api.patch(`/resumes/${id}`, body)),
  duplicate: (id) => unwrap(api.post(`/resumes/${id}/duplicate`)),
  setDefault: (id) => unwrap(api.post(`/resumes/${id}/default`)),
  remove: (id) => unwrap(api.delete(`/resumes/${id}`)),
};

export const documentAPI = {
  list: () => unwrap(api.get('/documents')),
  upload: (formData) =>
    unwrap(api.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })),
  addLink: (body) => unwrap(api.post('/documents/link', body)),
  checklist: (opportunityId) => unwrap(api.get(`/documents/checklist/${opportunityId}`)),
  proofOfWork: () => unwrap(api.get('/documents/proof-of-work')),
  remove: (id) => unwrap(api.delete(`/documents/${id}`)),
  downloadUrl: (id) => `/api/documents/${id}/download`,
};

export const interviewAPI = {
  questions: (params) => unwrap(api.get('/interview/questions', { params })),
  answer: (body) => unwrap(api.post('/interview/answer', body)),
  attempts: () => unwrap(api.get('/interview/attempts')),
  attempt: (id) => unwrap(api.get(`/interview/attempts/${id}`)),
  // admin
  listAll: () => unwrap(api.get('/interview/admin/questions')),
  create: (body) => unwrap(api.post('/interview/admin/questions', body)),
  update: (id, body) => unwrap(api.patch(`/interview/admin/questions/${id}`, body)),
  remove: (id) => unwrap(api.delete(`/interview/admin/questions/${id}`)),
};

export const roomAPI = {
  list: () => unwrap(api.get('/rooms')),
  get: (idOrSlug) => unwrap(api.get(`/rooms/${idOrSlug}`)),
  join: (id) => unwrap(api.post(`/rooms/${id}/join`)),
  leave: (id) => unwrap(api.post(`/rooms/${id}/leave`)),
  messages: (id) => unwrap(api.get(`/rooms/${id}/messages`)),
  postMessage: (id, body) => unwrap(api.post(`/rooms/${id}/messages`, body)),
  addResource: (id, body) => unwrap(api.post(`/rooms/${id}/resources`, body)),
  summary: (id) => unwrap(api.get(`/rooms/${id}/summary`)),
  react: (messageId, emoji) => unwrap(api.post(`/rooms/messages/${messageId}/react`, { emoji })),
  pin: (messageId) => unwrap(api.post(`/rooms/messages/${messageId}/pin`)),
  report: (messageId, reason) => unwrap(api.post(`/rooms/messages/${messageId}/report`, { reason })),
  startWatch: (id, body) => unwrap(api.post(`/rooms/${id}/watch`, body)),
  getWatch: (sessionId) => unwrap(api.get(`/rooms/watch/${sessionId}`)),
  endWatch: (sessionId) => unwrap(api.post(`/rooms/watch/${sessionId}/end`)),
  addStudyPoint: (sessionId, body) => unwrap(api.post(`/rooms/watch/${sessionId}/study-point`, body)),
  // admin
  // ---- Google Meet live sessions ----
  meetList: (roomId) => unwrap(api.get(`/rooms/${roomId}/meet`)),
  meetUpcoming: () => unwrap(api.get('/rooms/meet/upcoming')),
  meetBrowse: (params) => unwrap(api.get('/rooms/meet/browse', { params })),
  meetGet: (sessionId) => unwrap(api.get(`/rooms/meet/${sessionId}`)),
  meetCreate: (roomId, body) => unwrap(api.post(`/rooms/${roomId}/meet`, body)),
  meetUpdate: (sessionId, body) => unwrap(api.patch(`/rooms/meet/${sessionId}`, body)),
  meetCancel: (sessionId) => unwrap(api.delete(`/rooms/meet/${sessionId}`)),
  meetRsvp: (sessionId, status) => unwrap(api.post(`/rooms/meet/${sessionId}/rsvp`, { status })),
  meetJoin: (sessionId) => unwrap(api.post(`/rooms/meet/${sessionId}/join`)),
  meetStart: (sessionId) => unwrap(api.post(`/rooms/meet/${sessionId}/start`)),
  meetEnd: (sessionId) => unwrap(api.post(`/rooms/meet/${sessionId}/end`)),
  meetRecap: (sessionId, body) => unwrap(api.post(`/rooms/meet/${sessionId}/recap`, body)),
  meetAttendance: (sessionId) => unwrap(api.get(`/rooms/meet/${sessionId}/attendance`)),

  create: (body) => unwrap(api.post('/rooms', body)),
  update: (id, body) => unwrap(api.patch(`/rooms/${id}`, body)),
  remove: (id) => unwrap(api.delete(`/rooms/${id}`)),
  reported: () => unwrap(api.get('/rooms/moderation/reported')),
  moderate: (messageId, action) => unwrap(api.post(`/rooms/moderation/${messageId}`, { action })),
};

export const notificationAPI = {
  list: (params) => unwrap(api.get('/notifications', { params })),
  markRead: (id) => unwrap(api.post(`/notifications/${id}/read`)),
  markAllRead: () => unwrap(api.post('/notifications/read-all')),
  remove: (id) => unwrap(api.delete(`/notifications/${id}`)),
  announcements: () => unwrap(api.get('/notifications/announcements/list')),
  createAnnouncement: (body) => unwrap(api.post('/notifications/announcements', body)),
  updateAnnouncement: (id, body) => unwrap(api.patch(`/notifications/announcements/${id}`, body)),
  removeAnnouncement: (id) => unwrap(api.delete(`/notifications/announcements/${id}`)),
};

export const dashboardAPI = {
  student: () => unwrap(api.get('/dashboard/student')),
  charts: () => unwrap(api.get('/dashboard/charts')),
  analytics: () => unwrap(api.get('/dashboard/admin/analytics')),
  studentDetail: (id) => unwrap(api.get(`/dashboard/admin/student/${id}`)),
  runReminders: () => unwrap(api.post('/admin/run-reminders')),
};

export default api;
