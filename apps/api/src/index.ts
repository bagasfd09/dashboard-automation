import './types.js';
import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { prisma } from '@qc-monitor/db';
import { DEFAULT_PORT, API_ROUTES } from '@qc-monitor/shared';
import minioPlugin from './plugins/minio.js';
import redisPlugin from './plugins/redis.js';
import { wsRoutes } from './routes/ws.js';
import { teamRoutes } from './routes/teams.js';
import { testCaseRoutes } from './routes/testCases.js';
import { runRoutes } from './routes/runs.js';
import { resultRoutes } from './routes/results.js';
import { artifactRoutes } from './routes/artifacts.js';
import { adminRoutes } from './routes/admin.routes.js';
import { retryRoutes } from './routes/retry.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { expireOldRequests } from './services/retryService.js';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
});

async function bootstrap() {
  await app.register(cors, {
    origin: process.env.FRONTEND_URL ?? process.env.APP_URL ?? 'http://localhost:3000',
    credentials: true,
  });
  await app.register(compress, { global: true });
  await app.register(cookie);
  await app.register(websocket);
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } }); // 50 MB
  await app.register(minioPlugin);
  await app.register(redisPlugin);

  app.get(API_ROUTES.HEALTH, async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  await app.register(wsRoutes);
  await app.register(teamRoutes, { prefix: '/api/teams' });
  await app.register(testCaseRoutes, { prefix: '/api/test-cases' });
  await app.register(runRoutes, { prefix: '/api/runs' });
  await app.register(resultRoutes, { prefix: '/api/results' });
  await app.register(artifactRoutes, { prefix: '/api/artifacts' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(retryRoutes, { prefix: '/api/retry' });
  await app.register(authRoutes, { prefix: '/api/auth' });

  // Expire stale PENDING retry requests every minute
  setInterval(() => void expireOldRequests(), 60_000);

  const port = parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);

  await app.listen({ port, host: '0.0.0.0' });
}

bootstrap().catch((err) => {
  app.log.error(err);
  prisma.$disconnect().finally(() => process.exit(1));
});
