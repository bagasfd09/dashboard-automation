import { prisma } from '@qc-monitor/db';
import type { Artifact, ArtifactType } from '@qc-monitor/db';
import type { Client as MinioClient } from 'minio';
import { eventService } from './eventService.js';

export async function uploadArtifact(
  testResultId: string,
  type: ArtifactType,
  filename: string,
  mimetype: string,
  buffer: Buffer,
  minio: MinioClient,
): Promise<Artifact | null> {
  const testResult = await prisma.testResult.findUnique({
    where: { id: testResultId },
    include: { testRun: { select: { teamId: true, id: true } } },
  });

  if (!testResult) return null;

  const { teamId, id: testRunId } = testResult.testRun;
  const objectPath = `${teamId}/${testRunId}/${testResultId}/${filename}`;

  await minio.putObject('qc-artifacts', objectPath, buffer, buffer.length, {
    'Content-Type': mimetype,
  });

  const artifact = await prisma.artifact.create({
    data: {
      testResultId,
      type,
      fileName: filename,
      fileUrl: objectPath,
      fileSize: buffer.length,
    },
  });
  eventService.broadcast(teamId, 'artifact:new', artifact);
  return artifact;
}

export async function getArtifactDownloadUrl(
  id: string,
  teamId: string | undefined,
  minio: MinioClient,
): Promise<string | null> {
  const artifact = await prisma.artifact.findUnique({
    where: { id },
    include: {
      testResult: {
        include: { testRun: { select: { teamId: true } } },
      },
    },
  });

  if (!artifact || artifact.testResult.testRun.teamId !== teamId) return null;

  return minio.presignedGetObject('qc-artifacts', artifact.fileUrl, 3600);
}
