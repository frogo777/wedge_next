import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createS3DeletionRegistry,
  deletionRegistryFromEnvironment,
} from '../packages/domain/deletion-registry-s3.ts';
import { deletionTombstoneKey } from '../packages/domain/repository.ts';

const config = {
  accountId: 'a'.repeat(32),
  bucket: 'wedge-deletion-registry',
  accessKeyId: 'A'.repeat(32),
  secretAccessKey: 's'.repeat(64),
};
const entityId = 'synthetic-entity';
const validTombstone = () => new Response(new Uint8Array(), {
  status: 200,
  headers: {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/octet-stream',
    'x-amz-meta-format': 'wedge-deletion-v1',
  },
});
const storageError = error => error?.code === 'storage_error';

test('Registro S3: firma un alta condicional sin revelar el ID de entidad', async () => {
  let observed;
  const registry = createS3DeletionRegistry(config, async request => {
    observed = request;
    return new Response(null, { status: 200 });
  });
  await registry.ensure(entityId);
  const expectedKey = await deletionTombstoneKey(entityId);
  assert.equal(observed.method, 'PUT');
  assert.equal(observed.url,
    `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${expectedKey}`);
  assert.equal(observed.url.includes(entityId), false);
  assert.equal(observed.headers.get('if-none-match'), '*');
  assert.equal(observed.headers.get('x-amz-meta-format'), 'wedge-deletion-v1');
  assert.match(observed.headers.get('authorization'), /^AWS4-HMAC-SHA256 /);
});

test('Registro S3: valida el tombstone existente al recibir precondición', async () => {
  const methods = [];
  const registry = createS3DeletionRegistry(config, async request => {
    methods.push(request.method);
    return request.method === 'PUT' ? new Response(null, { status: 412 }) : validTombstone();
  });
  await registry.ensure(entityId);
  assert.deepEqual(methods, ['PUT', 'GET']);
  assert.equal(await registry.has(entityId), true);
  assert.deepEqual(methods, ['PUT', 'GET', 'GET']);
});

test('Registro S3: falla cerrado ante metadatos alterados o configuración parcial', async () => {
  const registry = createS3DeletionRegistry(config, async () => new Response(new Uint8Array(), {
    status: 200,
    headers: { 'Content-Type': 'application/octet-stream' },
  }));
  await assert.rejects(registry.has(entityId), storageError);
  assert.throws(() => deletionRegistryFromEnvironment({
    WEDGE_DELETION_REGISTRY_MODE: 's3',
    WEDGE_DELETION_R2_ACCOUNT_ID: config.accountId,
  }, {}), storageError);
  assert.throws(() => deletionRegistryFromEnvironment({
    WEDGE_DELETION_REGISTRY_MODE: 's3',
  }, {}), storageError);
});
