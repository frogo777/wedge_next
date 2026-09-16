import { AwsClient } from 'aws4fetch';
import {
  createR2DeletionRegistry,
  deletionTombstoneKey,
  DomainError,
  type DeletionRegistry,
} from './repository.ts';

export type DeletionRegistryEnvironment = Readonly<{
  WEDGE_DELETION_REGISTRY_MODE?: string;
  WEDGE_DELETION_R2_ACCOUNT_ID?: string;
  WEDGE_DELETION_R2_BUCKET?: string;
  WEDGE_DELETION_R2_ACCESS_KEY_ID?: string;
  WEDGE_DELETION_R2_SECRET_ACCESS_KEY?: string;
}>;

type S3RegistryConfig = Readonly<{
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}>;

type FetchRequest = (request: Request) => Promise<Response>;

function configuration(env: DeletionRegistryEnvironment): S3RegistryConfig | null {
  const mode = env.WEDGE_DELETION_REGISTRY_MODE?.trim() ?? '';
  const values = {
    accountId: env.WEDGE_DELETION_R2_ACCOUNT_ID?.trim() ?? '',
    bucket: env.WEDGE_DELETION_R2_BUCKET?.trim() ?? '',
    accessKeyId: env.WEDGE_DELETION_R2_ACCESS_KEY_ID?.trim() ?? '',
    secretAccessKey: env.WEDGE_DELETION_R2_SECRET_ACCESS_KEY?.trim() ?? '',
  };
  const configured = Object.values(values).filter(Boolean).length;
  if ((mode === '' || mode === 'binding') && configured === 0) return null;
  if ((mode !== '' && mode !== 's3') || configured !== 4
    || !/^[0-9a-f]{32}$/.test(values.accountId)
    || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(values.bucket)
    || !/^[A-Za-z0-9_-]{16,128}$/.test(values.accessKeyId)
    || values.secretAccessKey.length < 32 || values.secretAccessKey.length > 256) {
    throw new DomainError('storage_error');
  }
  return values;
}

function objectUrl(config: S3RegistryConfig, objectKey: string) {
  const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/');
  return `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${encodedKey}`;
}

export function createS3DeletionRegistry(config: S3RegistryConfig,
  fetchRequest: FetchRequest = request => fetch(request)): DeletionRegistry {
  const validated = configuration({
    WEDGE_DELETION_REGISTRY_MODE: 's3',
    WEDGE_DELETION_R2_ACCOUNT_ID: config.accountId,
    WEDGE_DELETION_R2_BUCKET: config.bucket,
    WEDGE_DELETION_R2_ACCESS_KEY_ID: config.accessKeyId,
    WEDGE_DELETION_R2_SECRET_ACCESS_KEY: config.secretAccessKey,
  });
  if (!validated) throw new DomainError('storage_error');
  const finalConfig = validated;
  const signer = new AwsClient({
    accessKeyId: finalConfig.accessKeyId,
    secretAccessKey: finalConfig.secretAccessKey,
    service: 's3',
    region: 'auto',
    retries: 0,
  });

  async function request(entityId: string, init: RequestInit) {
    const url = objectUrl(finalConfig, await deletionTombstoneKey(entityId));
    try {
      return await fetchRequest(await signer.sign(url, init));
    } catch {
      throw new DomainError('storage_error');
    }
  }

  const registry: DeletionRegistry = {
    async has(entityId) {
      const response = await request(entityId, { method: 'GET' });
      if (response.status === 404) return false;
      if (!response.ok
        || response.headers.get('content-type') !== 'application/octet-stream'
        || response.headers.get('cache-control') !== 'no-store'
        || response.headers.get('x-amz-meta-format') !== 'wedge-deletion-v1') {
        throw new DomainError('storage_error');
      }
      if ((await response.arrayBuffer()).byteLength !== 0) throw new DomainError('storage_error');
      return true;
    },
    async ensure(entityId) {
      const response = await request(entityId, {
        method: 'PUT',
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'application/octet-stream',
          'If-None-Match': '*',
          'x-amz-meta-format': 'wedge-deletion-v1',
        },
        body: new Uint8Array(),
      });
      if (response.ok) return;
      if (response.status === 412 && await registry.has(entityId)) return;
      throw new DomainError('storage_error');
    },
  };
  return registry;
}

export function deletionRegistryFromEnvironment(env: DeletionRegistryEnvironment,
  fallbackBucket: R2Bucket): DeletionRegistry {
  const config = configuration(env);
  return config ? createS3DeletionRegistry(config) : createR2DeletionRegistry(fallbackBucket);
}
