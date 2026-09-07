import http from 'http';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { initSocket } from './services/socket.service.js';
import { startCronJobs } from './services/cron.service.js';

async function bootstrap() {
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  const io = initSocket(server);
  app.set('io', io);

  startCronJobs();

  server.listen(env.PORT, '0.0.0.0', () => {
    console.log(`\n🚀 CampusOrbit API running on http://0.0.0.0:${env.PORT}`);
    console.log(`   Environment : ${env.NODE_ENV}`);
    console.log(`   MongoDB     : ${env.MONGODB_URI}`);
    console.log(`   Socket.IO   : ready`);
    console.log(`   AI mode     : ${env.GEMINI_API_KEY ? 'live-ai' : 'Demo AI Mode (seeded fallback)'}\n`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received, shutting down gracefully...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 8000);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
