import { env } from 'cloudflare:workers';
import { handleProgress } from '../../progress-service.mjs';
import { eraseDemoSourceEntity, storeDemoSources } from '../../../packages/domain/demo-export.ts';
export const dynamic = 'force-dynamic';
export function GET(request: Request) { return handleProgress(request, env.DB); }
export function POST(request: Request) {
  return handleProgress(request, env.DB, {
    beforeAddDocument: ({ userId, sampleId, xml }: { userId: string; sampleId: string; xml: string }) =>
      storeDemoSources(env.DB, env.BUCKET, { userId }, [{ id: sampleId, xml }]),
    beforeErase: ({ userId }: { userId: string }) => eraseDemoSourceEntity(
      env.DB,
      env.BUCKET,
      { userId },
    ),
  });
}
