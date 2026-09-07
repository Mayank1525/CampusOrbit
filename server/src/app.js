import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import { env } from './config/env.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { ok } from './utils/apiResponse.js';
import { aiStatus } from './services/ai.service.js';
import { protect, authorize } from './middleware/auth.js';
import { runAllChecks } from './services/cron.service.js';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import pathRoutes from './routes/path.routes.js';
import lessonRoutes from './routes/lesson.routes.js';
import noteRoutes from './routes/note.routes.js';
import quizRoutes from './routes/quiz.routes.js';
import revisionRoutes from './routes/revision.routes.js';
import videoQueueRoutes from './routes/videoQueue.routes.js';
import opportunityRoutes from './routes/opportunity.routes.js';
import applicationRoutes from './routes/application.routes.js';
import resumeRoutes from './routes/resume.routes.js';
import documentRoutes from './routes/document.routes.js';
import interviewRoutes from './routes/interview.routes.js';
import roomRoutes from './routes/room.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  // CORS: allow the Vite dev origin and any e2b preview host, with credentials.
  app.use(
    cors({
      origin: (origin, cb) => cb(null, true),
      credentials: true,
    })
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  if (env.NODE_ENV !== 'test') app.use(morgan('dev'));
  app.use('/api', generalLimiter);

  // Health + meta
  app.get('/api/health', (req, res) =>
    ok(res, {
      status: 'healthy',
      env: env.NODE_ENV,
      time: new Date().toISOString(),
      ai: aiStatus(),
    })
  );
  app.get('/api/ai-status', (req, res) => ok(res, aiStatus()));

  // Manual trigger for the cron reminder checks (useful for demos/tests).
  app.post('/api/admin/run-reminders', protect, authorize('admin'), async (req, res, next) => {
    try {
      const result = await runAllChecks();
      return ok(res, result, 'Reminder checks executed');
    } catch (err) {
      return next(err);
    }
  });

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/paths', pathRoutes);
  app.use('/api/lessons', lessonRoutes);
  app.use('/api/notes', noteRoutes);
  app.use('/api/quizzes', quizRoutes);
  app.use('/api/revisions', revisionRoutes);
  app.use('/api/video-queue', videoQueueRoutes);
  app.use('/api/opportunities', opportunityRoutes);
  app.use('/api/applications', applicationRoutes);
  app.use('/api/resumes', resumeRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/interview', interviewRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // Serve the built client in production (single-origin deploy).
  const clientDist = path.resolve(__dirname, '../../client/dist');

  // Hashed filenames (app-a1b2c3.js) are immutable, so cache them hard.
  // index.html must NEVER be cached: a stale shell keeps pointing at the old
  // bundle after a deploy, so already-fixed bugs appear to still be broken.
  app.use(
    express.static(clientDist, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (/\.[0-9a-f]{8,}\.(js|css|woff2?|png|jpe?g|svg|webp)$/i.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );

  app.get(/^\/(?!api).*/, (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) next();
    });
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
