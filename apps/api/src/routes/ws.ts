import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { prisma } from '@qc-monitor/db';
import { eventService } from '../services/eventService.js';

type WsQuerystring = { apiKey?: string; adminKey?: string };

export async function wsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/ws',
    { websocket: true },
    async (socket: WebSocket, request: FastifyRequest<{ Querystring: WsQuerystring }>) => {
      const { apiKey, adminKey } = request.query;

      // ── Admin connection ────────────────────────────────────────────────
      if (adminKey) {
        const secret = process.env.ADMIN_SECRET_KEY;

        if (!secret || adminKey !== secret) {
          socket.close(4001, 'Invalid admin key');
          return;
        }

        eventService.addAdminConnection(socket);
        fastify.log.info('Admin WebSocket client connected');

        socket.send(
          JSON.stringify({
            event: 'connected',
            data: { role: 'admin' },
            timestamp: new Date().toISOString(),
          }),
        );

        socket.on('message', (raw: Buffer) => {
          try {
            const msg = JSON.parse(raw.toString()) as { type?: string };
            if (msg.type === 'ping') {
              socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
            }
          } catch {
            // Ignore malformed messages
          }
        });

        socket.on('close', () => {
          eventService.removeAdminConnection(socket);
          fastify.log.info('Admin WebSocket client disconnected');
        });

        return;
      }

      // ── Team connection ─────────────────────────────────────────────────
      if (!apiKey) {
        socket.close(4001, 'Missing API key');
        return;
      }

      const team = await prisma.team.findUnique({ where: { apiKey } });

      if (!team) {
        socket.close(4001, 'Invalid API key');
        return;
      }

      // Cache team name so admin broadcasts can include it
      eventService.registerTeamName(team.id, team.name);
      eventService.addConnection(team.id, socket);
      fastify.log.info({ teamId: team.id }, 'WebSocket client connected');

      socket.send(
        JSON.stringify({
          event: 'connected',
          data: { teamId: team.id },
          timestamp: new Date().toISOString(),
        }),
      );

      socket.on('message', (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString()) as { type?: string };
          if (msg.type === 'ping') {
            socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          }
        } catch {
          // Ignore malformed messages
        }
      });

      socket.on('close', () => {
        eventService.removeConnection(team.id, socket);
        fastify.log.info({ teamId: team.id }, 'WebSocket client disconnected');
      });
    },
  );
}
