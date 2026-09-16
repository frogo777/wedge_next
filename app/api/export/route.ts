import { env } from 'cloudflare:workers';
import { samples, sampleIds } from '../../../packages/documents/demo-samples.mjs';
import { DomainError, exportEntityFiles, type EntityExportFile } from '../../../packages/domain/repository.ts';
import { findDemoSourceEntity, storeDemoSources } from '../../../packages/domain/demo-export.ts';
import { zipReadableStream, type ZipInputFile } from '../../../packages/domain/zip-stream.ts';
import { readProgressSnapshot } from '../../progress-service.mjs';

export const dynamic = 'force-dynamic';

const responseHeaders = {
  'Cache-Control': 'private, no-store',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Vary': 'oai-authenticated-user-id',
};

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: responseHeaders });
}

async function readJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new DomainError('invalid_input');
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > 256) {
      await reader.cancel();
      throw new DomainError('limit_exceeded');
    }
    text += decoder.decode(next.value, { stream: true });
  }
  text += decoder.decode();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new DomainError('invalid_input');
  }
}

function validateVersion(value: unknown): asserts value is { version: number; revision: string | null } {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !['version', 'revision'].includes(key))) {
    throw new DomainError('invalid_input');
  }
  const body = value as Record<string, unknown>;
  if (!Number.isSafeInteger(body.version) || (body.version as number) < 0
    || !(body.revision === null || typeof body.revision === 'string' && body.revision.length <= 64)) {
    throw new DomainError('invalid_input');
  }
}

function domainFile(file: EntityExportFile): ZipInputFile {
  return { path: `private-entity/${file.path}`, bytes: file.bytes };
}

export async function POST(request: Request) {
  const userId = request.headers.get('oai-authenticated-user-id');
  if (!userId || !userId.trim() || userId.length > 256) return jsonError('unauthorized', 401);
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin
    || request.headers.get('sec-fetch-site') === 'cross-site') return jsonError('invalid_origin', 403);
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return jsonError('unsupported_media_type', 415);
  }
  if (!env.DB || !env.BUCKET) return jsonError('storage_unavailable', 503);

  try {
    const requested = await readJson(request);
    validateVersion(requested);
    const snapshot = await readProgressSnapshot(env.DB, userId);
    if (snapshot.state.version !== requested.version || snapshot.state.revision !== requested.revision) {
      return jsonError('version_conflict', 409);
    }

    const documentIds = [...new Set(snapshot.state.documents.map((document: { sampleId?: unknown }) => document.sampleId))];
    if (documentIds.some(id => typeof id !== 'string' || !sampleIds.includes(id))) {
      throw new DomainError('storage_error');
    }

    let firstDomainFile: EntityExportFile | undefined;
    let remainingDomainFiles: AsyncGenerator<EntityExportFile> | undefined;
    let entityId: string | null;
    if (documentIds.length > 0) {
      const sources = documentIds.sort().map(id => ({ id: id as string, xml: samples[id as keyof typeof samples] }));
      const identity = { userId } as const;
      entityId = await storeDemoSources(env.DB, env.BUCKET, identity, sources);
    } else {
      entityId = await findDemoSourceEntity(env.DB, { userId });
    }
    if (entityId) {
      const identity = { userId } as const;
      remainingDomainFiles = exportEntityFiles(env.DB, env.BUCKET, identity, entityId);
      const first = await remainingDomainFiles.next();
      if (first.done) throw new DomainError('export_incomplete');
      firstDomainFile = first.value;
    }

    const exportedAt = new Date().toISOString();
    const demoBytes = new TextEncoder().encode(`${JSON.stringify({
      format: 'wedge-complete-demo-export',
      formatVersion: 1,
      exportedAt,
      record: snapshot.record,
      scope: 'Progreso y originales sintéticos de la demostración privada de Wedge.',
    }, null, 2)}\n`);
    async function* files(): AsyncGenerator<ZipInputFile> {
      try {
        yield { path: 'demo-progress.json', bytes: demoBytes };
        if (firstDomainFile && remainingDomainFiles) {
          yield domainFile(firstDomainFile);
          for await (const file of remainingDomainFiles) yield domainFile(file);
        }
      } catch (error) {
        const code = error instanceof DomainError ? error.code : 'storage_error';
        console.error(JSON.stringify({ event: 'wedge_demo_export_stream_failed', code }));
        throw error;
      }
    }

    return new Response(zipReadableStream(files()), {
      headers: {
        ...responseHeaders,
        'Content-Disposition': 'attachment; filename="wedge-copia-completa.zip"',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Content-Type': 'application/zip',
      },
    });
  } catch (error) {
    const code = error instanceof DomainError ? error.code : 'storage_error';
    console.error(JSON.stringify({ event: 'wedge_demo_export_failed', code }));
    if (code === 'invalid_input') return jsonError('invalid_payload', 400);
    if (code === 'limit_exceeded') return jsonError('payload_too_large', 413);
    if (code === 'not_found') return jsonError('not_found', 404);
    if (code === 'command_conflict' || code === 'export_incomplete') return jsonError(code, 409);
    return jsonError('storage_unavailable', 503);
  }
}
