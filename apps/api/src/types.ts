import type { Team, UserRole } from '@qc-monitor/db';
import type { Client as MinioClient } from 'minio';

declare module 'fastify' {
  interface FastifyRequest {
    team: Team | undefined;
    isAdmin: boolean;
    user:
      | {
          id: string;
          email: string;
          role: UserRole;
        }
      | undefined;
  }

  interface FastifyInstance {
    minio: MinioClient;
  }
}
