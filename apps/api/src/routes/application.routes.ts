import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/permission.middleware.js';
import { resolveTeamScope, canUserAccessTeam } from '../helpers/data-scope.js';
import { logActivity } from '../services/auth.service.js';
import * as appService from '../services/application.service.js';

export async function applicationRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  const auth = requireAuth();

  /** GET /api/admin/applications — list all accessible applications */
  fastify.get('/', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const scope = await resolveTeamScope(user);
    try {
      const apps = await appService.listApplications(scope?.scopeTeamIds);
      return reply.send(apps);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** GET /api/admin/applications/:id */
  fastify.get('/:id', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const app = await appService.getApplication(id);
      if (!app) return reply.code(404).send({ error: 'Application not found', statusCode: 404 });

      const canAccess = await canUserAccessTeam(request.user!, app.teamId);
      if (!canAccess) {
        return reply.code(403).send({ error: 'Insufficient permissions', statusCode: 403 });
      }
      return reply.send(app);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** POST /api/admin/applications — TEAM_LEAD+ can create for their team */
  fastify.post('/', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const body = request.body as {
      name?: string;
      slug?: string;
      description?: string;
      icon?: string;
      color?: string;
      environments?: string[];
      teamId?: string;
    };

    if (!body.name?.trim()) {
      return reply.code(400).send({ error: 'Application name is required', statusCode: 400 });
    }
    if (!body.teamId) {
      return reply.code(400).send({ error: 'teamId is required', statusCode: 400 });
    }

    const canAccess = await canUserAccessTeam(user, body.teamId);
    if (!canAccess) {
      return reply.code(403).send({ error: 'Insufficient permissions', statusCode: 403 });
    }

    // Only TEAM_LEAD and above can create applications
    const allowedRoles = ['ADMIN', 'MANAGER', 'TEAM_LEAD'];
    if (!allowedRoles.includes(user.role)) {
      return reply.code(403).send({ error: 'Insufficient permissions', statusCode: 403 });
    }

    try {
      const app = await appService.createApplication({
        name: body.name.trim(),
        slug: (body.slug || body.name).trim(),
        description: body.description,
        icon: body.icon,
        color: body.color,
        environments: body.environments,
        teamId: body.teamId,
        createdById: user.id,
      });
      await logActivity(user.id, 'application.created', body.teamId, {
        name: app.name,
        slug: app.slug,
      });
      return reply.code(201).send(app);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Unique constraint')) {
        return reply.code(409).send({
          error: 'An application with this slug already exists for this team',
          statusCode: 409,
        });
      }
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** PATCH /api/admin/applications/:id */
  fastify.patch('/:id', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      description?: string;
      icon?: string;
      color?: string;
      environments?: string[];
      isActive?: boolean;
    };

    try {
      const existing = await appService.getApplication(id);
      if (!existing) {
        return reply.code(404).send({ error: 'Application not found', statusCode: 404 });
      }

      const canAccess = await canUserAccessTeam(user, existing.teamId);
      const allowedRoles = ['ADMIN', 'MANAGER', 'TEAM_LEAD'];
      if (!canAccess || !allowedRoles.includes(user.role)) {
        return reply.code(403).send({ error: 'Insufficient permissions', statusCode: 403 });
      }

      const app = await appService.updateApplication(id, body);
      await logActivity(user.id, 'application.updated', existing.teamId, { name: app.name });
      return reply.send(app);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** DELETE /api/admin/applications/:id — ADMIN/MANAGER only */
  fastify.delete('/:id', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    if (!['ADMIN', 'MANAGER'].includes(user.role)) {
      return reply.code(403).send({ error: 'Insufficient permissions', statusCode: 403 });
    }

    try {
      const existing = await appService.getApplication(id);
      if (!existing) {
        return reply.code(404).send({ error: 'Application not found', statusCode: 404 });
      }

      await appService.deleteApplication(id);
      await logActivity(user.id, 'application.deleted', existing.teamId, {
        name: existing.name,
        slug: existing.slug,
      });
      return reply.code(204).send();
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });
}
