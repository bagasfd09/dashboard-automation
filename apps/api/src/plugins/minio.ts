import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { Client as MinioClient } from 'minio';

async function minioPlugin(fastify: FastifyInstance): Promise<void> {
  const endpointRaw = process.env.MINIO_ENDPOINT ?? 'localhost:9000';
  const useSSL = process.env.MINIO_USE_SSL === 'true';

  // Parse host and port from endpoint string (e.g. "localhost:9000" or "minio:9000")
  const colonIndex = endpointRaw.lastIndexOf(':');
  const endPoint = colonIndex !== -1 ? endpointRaw.slice(0, colonIndex) : endpointRaw;
  const port = colonIndex !== -1 ? parseInt(endpointRaw.slice(colonIndex + 1), 10) : (useSSL ? 443 : 9000);

  const client = new MinioClient({
    endPoint,
    port,
    useSSL,
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
  });

  const bucket = 'qc-artifacts';
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket);
    fastify.log.info(`MinIO bucket "${bucket}" created`);
  }

  fastify.decorate('minio', client);
}

export default fp(minioPlugin, { name: 'minio' });
