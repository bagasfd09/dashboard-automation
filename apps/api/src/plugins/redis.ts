import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import { eventService } from '../services/eventService.js';

async function redisPlugin(fastify: FastifyInstance): Promise<void> {
  const url = process.env.REDIS_URL;

  if (!url) {
    fastify.log.info('REDIS_URL not set — Redis pub/sub disabled');
    return;
  }

  // Separate clients: publisher cannot be used for subscribe and vice-versa
  const publisher = new Redis(url, { lazyConnect: true });
  const subscriber = new Redis(url, { lazyConnect: true });

  try {
    await publisher.connect();
    await subscriber.connect();
  } catch (err) {
    fastify.log.warn({ err }, 'Redis connection failed — pub/sub disabled');
    await publisher.quit().catch(() => {});
    await subscriber.quit().catch(() => {});
    return;
  }

  // Wire the publisher into the EventService singleton so services can broadcast
  eventService.setPublisher(publisher);

  // Pattern-subscribe to all team event channels: "team:{teamId}:events"
  await subscriber.psubscribe('team:*:events');
  // Subscribe to the admin fan-out channel
  await subscriber.subscribe('admin:events');

  // pmessage fires for psubscribe matches
  subscriber.on('pmessage', (_pattern: string, channel: string, message: string) => {
    const match = /^team:(.+):events$/.exec(channel);
    if (!match) return;
    const teamId = match[1]!;
    // Forward to local WebSocket connections only — do NOT re-broadcast to Redis
    eventService.sendLocal(teamId, message);
  });

  // message fires for exact-channel subscribe
  subscriber.on('message', (channel: string, message: string) => {
    if (channel === 'admin:events') {
      eventService.sendLocalAdmin(message);
    }
  });

  subscriber.on('error', (err) => fastify.log.error({ err }, 'Redis subscriber error'));
  publisher.on('error', (err) => fastify.log.error({ err }, 'Redis publisher error'));

  fastify.addHook('onClose', async () => {
    await subscriber.quit().catch(() => {});
    await publisher.quit().catch(() => {});
  });

  fastify.log.info('Redis pub/sub connected');
}

export default fp(redisPlugin, { name: 'redis' });
