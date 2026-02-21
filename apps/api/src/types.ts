import type { Team } from '@qc-monitor/db';
import type { Client as MinioClient } from 'minio';

declare module 'fastify' {
  interface FastifyRequest {
    team: Team | undefined;
    isAdmin: boolean;
  }

  interface FastifyInstance {
    minio: MinioClient;
  }
}
