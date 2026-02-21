import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import * as artifactService from '../services/artifactService.js';
import type { ArtifactType } from '@qc-monitor/db';

export async function artifactRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/upload',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        let testResultId: string | undefined;
        let type: ArtifactType | undefined;
        let fileBuffer: Buffer | undefined;
        let filename: string | undefined;
        let mimetype: string | undefined;

        const parts = request.parts();
        for await (const part of parts) {
          if (part.type === 'field') {
            if (part.fieldname === 'testResultId') testResultId = part.value as string;
            if (part.fieldname === 'type') type = part.value as ArtifactType;
          } else if (part.type === 'file') {
            filename = part.filename;
            mimetype = part.mimetype;
            const chunks: Buffer[] = [];
            for await (const chunk of part.file) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            fileBuffer = Buffer.concat(chunks);
          }
        }

        if (!testResultId || !type || !fileBuffer || !filename || !mimetype) {
          return reply.code(400).send({
            error: 'Missing required fields: testResultId, type, and file',
            statusCode: 400,
          });
        }

        const validTypes: ArtifactType[] = ['SCREENSHOT', 'VIDEO', 'TRACE', 'LOG'];
        if (!validTypes.includes(type)) {
          return reply.code(400).send({ error: 'Invalid artifact type', statusCode: 400 });
        }

        const artifact = await artifactService.uploadArtifact(
          testResultId,
          type,
          filename,
          mimetype,
          fileBuffer,
          fastify.minio,
        );

        if (!artifact) {
          return reply.code(404).send({ error: 'Test result not found', statusCode: 404 });
        }

        return reply.code(201).send(artifact);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  fastify.get(
    '/:id/download',
    {
      preHandler: authenticate,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const url = await artifactService.getArtifactDownloadUrl(id, request.team!.id, fastify.minio);
        if (!url) return reply.code(404).send({ error: 'Artifact not found', statusCode: 404 });
        return reply.redirect(url);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );
}
