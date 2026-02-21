import type { WebSocket } from '@fastify/websocket';

// ws.WebSocket.OPEN === 1
const WS_OPEN = 1;

export interface EventPayload {
  event: string;
  data: unknown;
  timestamp: string;
}

/**
 * Minimal interface for a Redis publish client.
 * Matches ioredis.Redis so we avoid importing ioredis here directly.
 */
interface RedisPublisher {
  publish(channel: string, message: string): Promise<number>;
}

class EventService {
  private readonly connections = new Map<string, Set<WebSocket>>();
  private readonly adminConnections = new Set<WebSocket>();
  /** Cache of teamId → teamName so admin broadcasts can be enriched without a DB round-trip. */
  private readonly teamNames = new Map<string, string>();
  private publisher: RedisPublisher | null = null;

  setPublisher(publisher: RedisPublisher): void {
    this.publisher = publisher;
  }

  /**
   * Cache a team name so it can be included in admin event payloads.
   * Called from the WebSocket route when a team client connects.
   */
  registerTeamName(teamId: string, name: string): void {
    this.teamNames.set(teamId, name);
  }

  // ── Team connections ──────────────────────────────────────────────────────

  addConnection(teamId: string, ws: WebSocket): void {
    if (!this.connections.has(teamId)) {
      this.connections.set(teamId, new Set());
    }
    this.connections.get(teamId)!.add(ws);
  }

  removeConnection(teamId: string, ws: WebSocket): void {
    const set = this.connections.get(teamId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) this.connections.delete(teamId);
  }

  // ── Admin connections ─────────────────────────────────────────────────────

  addAdminConnection(ws: WebSocket): void {
    this.adminConnections.add(ws);
  }

  removeAdminConnection(ws: WebSocket): void {
    this.adminConnections.delete(ws);
  }

  // ── Send helpers ──────────────────────────────────────────────────────────

  /**
   * Send a pre-serialised message to all local WebSocket connections for a team.
   * Called by the Redis subscriber so it does NOT re-publish to Redis.
   */
  sendLocal(teamId: string, message: string): void {
    const set = this.connections.get(teamId);
    if (!set) return;
    for (const ws of set) {
      if (ws.readyState === WS_OPEN) {
        ws.send(message);
      }
    }
  }

  /**
   * Send a pre-serialised message to all local admin WebSocket connections.
   * Called by the Redis subscriber for the admin channel.
   */
  sendLocalAdmin(message: string): void {
    for (const ws of this.adminConnections) {
      if (ws.readyState === WS_OPEN) {
        ws.send(message);
      }
    }
  }

  /**
   * Build the payload, send it to team connections, to admin connections (enriched
   * with teamId + teamName), and publish to Redis for multi-instance fan-out.
   */
  broadcast(teamId: string, event: string, data: unknown): void {
    const timestamp = new Date().toISOString();

    // ── Team payload ──────────────────────────────────────────────────────
    const teamPayload: EventPayload = { event, data, timestamp };
    const teamMessage = JSON.stringify(teamPayload);

    this.sendLocal(teamId, teamMessage);

    if (this.publisher) {
      void this.publisher.publish(`team:${teamId}:events`, teamMessage);
    }

    // ── Admin payload (same event, data enriched with teamId + teamName) ──
    const teamName = this.teamNames.get(teamId);
    const enrichedData =
      typeof data === 'object' && data !== null
        ? { ...(data as Record<string, unknown>), teamId, teamName }
        : { payload: data, teamId, teamName };

    const adminPayload: EventPayload = { event, data: enrichedData, timestamp };
    const adminMessage = JSON.stringify(adminPayload);

    this.sendLocalAdmin(adminMessage);

    if (this.publisher) {
      void this.publisher.publish('admin:events', adminMessage);
    }
  }
}

export const eventService = new EventService();
