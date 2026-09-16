import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Miniflare } from 'miniflare';
import { createEntity, recordSource, readSource, exportEntity, exportEntityFiles, eraseEntity, auditEntityStorage,
  hasEntityDeletionTombstone, reconcileRestoredEntityDeletion, reconcileRestoredEntityDeletionsPage,
  MAX_SOURCES_PER_ENTITY, DELETION_TOMBSTONE_PREFIX, DELETION_TOMBSTONE_RETENTION_DAYS
} from '../../packages/domain/repository.ts';
import { ensureDemoSourceEntity, storeDemoSources, eraseDemoSourceEntity } from '../../packages/domain/demo-export.ts';

// Real D1 semantics in an isolated local runtime. No HTTP route or real tax data.
const alice = { userId: 'synthetic-alice' }, bob = { userId: 'synthetic-bob' };
const bytes = text => new TextEncoder().encode(text);
const hashAbc = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const objectPath = (entity, hash) => `entities/${entity}/sources/${hash}`;
const tombstonePath = async entity => {
  const value = bytes(`wedge:deletion:v1:${entity}`);
  return `${DELETION_TOMBSTONE_PREFIX}${Buffer.from(await crypto.subtle.digest('SHA-256', value)).toString('hex')}`;
};
const code = expected => error => error.code === expected && error.message === expected;
let runtime, db, bucket;
function wrapBucket(overrides) {
  return new Proxy(bucket, { get(target, property) {
    if (property in overrides) return overrides[property];
    const value = Reflect.get(target, property);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
}
async function migrate(target) {
  for (const file of (await readdir('drizzle')).filter(f => f.endsWith('.sql')).sort()) {
    if (file.startsWith('0005_')) {
      await target.prepare("INSERT INTO demo_progress (user_id, stage, resolved, version, updated_at) VALUES ('synthetic-demo', 'draft', '[]', 0, '2026-09-14')").run();
    }
    if (file.startsWith('0006_')) {
      await target.prepare("INSERT INTO financial_entities (id, created_at) VALUES ('synthetic-precloud', '2026-09-14')").run();
      await target.prepare("INSERT INTO entity_memberships (entity_id, user_id, role) VALUES ('synthetic-precloud', 'synthetic-alice', 'owner')").run();
      await target.prepare("INSERT INTO source_artifacts (entity_id, sha256, byte_length, created_at) VALUES ('synthetic-precloud', ?, 3, '2026-09-14')").bind(hashAbc).run();
      await target.prepare("INSERT INTO import_receipts (entity_id, command_id, sha256, actor_id, received_at) VALUES ('synthetic-precloud', 'legacy', ?, 'synthetic-alice', '2026-09-14')").bind(hashAbc).run();
      await target.prepare("INSERT INTO audit_events (entity_id, event_id, kind, command_id, actor_id, occurred_at) VALUES ('synthetic-precloud', 'source:legacy', 'source_received', 'legacy', 'synthetic-alice', '2026-09-14')").run();
    }
    const sql = await readFile(join('drizzle', file), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)) await target.prepare(statement).run();
  }
}
before(async () => {
  runtime = new Miniflare({ cf: false, modules: true,
    script: 'export default { fetch() { return new Response("synthetic"); } };',
    compatibilityDate: '2026-05-15', d1Databases: ['DB', 'ROLLBACK', 'RECOVERY'], r2Buckets: ['BUCKET'],
  });
  db = await runtime.getD1Database('DB');
  bucket = await runtime.getR2Bucket('BUCKET');
  await migrate(db);
  assert.equal((await db.prepare("SELECT stage FROM demo_progress WHERE user_id = 'synthetic-demo'").first()).stage, 'draft');
  assert.deepEqual(await db.prepare("SELECT storage_state FROM source_artifacts WHERE entity_id = 'synthetic-precloud'").first(),
    { storage_state: 'metadata_only' });
  assert.equal(await db.prepare("SELECT entity_id FROM source_objects WHERE entity_id = 'synthetic-precloud'").first(), null);
}, { timeout: 20000 });
after(async () => { await runtime?.dispose(); });

test('Dominio: conserva bytes originales privados y exporta procedencia sin filtrar la clave interna', async () => {
  const entity = await createEntity(db, alice);
  const receipt = await recordSource(db, bucket, alice, entity.id, 'first', bytes('abc'));
  const exported = await exportEntity(db, alice, entity.id);
  assert.equal(exported.formatVersion, 2);
  assert.equal(receipt.sha256, hashAbc);
  assert.equal(receipt.actor_id, alice.userId);
  assert.equal(exported.sources[0].storage_state, 'stored');
  assert.equal(exported.sources[0].media_type, 'application/xml');
  assert.equal('object_key' in exported.sources[0], false);
  assert.equal(exported.sources[0].byte_length, 3);
  assert.deepEqual(exported.receipts, [receipt]);
  assert.deepEqual(exported.audit.map(e => e.kind), ['entity_created', 'source_received']);
  assert.equal(exported.audit[1].actor_id, alice.userId);
  assert.equal(exported.audit[1].occurred_at, receipt.received_at);
  assert.deepEqual(exported.pendingUploads, []);
  const original = await readSource(db, bucket, alice, entity.id, receipt.sha256);
  assert.deepEqual(original.bytes, bytes('abc'));
});

test('Dominio: el puente sintético crea una sola entidad, reintenta y borra D1/R2', async () => {
  const identity = { userId: 'synthetic-demo-export' };
  const entities = await Promise.all([
    ensureDemoSourceEntity(db, identity),
    ensureDemoSourceEntity(db, identity),
  ]);
  assert.equal(entities[0], entities[1]);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM demo_source_entities WHERE user_id = ?')
    .bind(identity.userId).first()).n, 1);
  const source = { id: 'service', xml: '<synthetic-export/>' };
  assert.equal(await storeDemoSources(db, bucket, identity, [source]), entities[0]);
  assert.equal(await storeDemoSources(db, bucket, identity, [source]), entities[0]);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM source_objects WHERE entity_id = ?')
    .bind(entities[0]).first()).n, 1);
  assert.equal(await eraseDemoSourceEntity(db, bucket, identity), true);
  assert.equal(await eraseDemoSourceEntity(db, bucket, identity), false);
  assert.equal((await bucket.list({ prefix: `entities/${entities[0]}/` })).objects.length, 0);
  assert.equal(await db.prepare('SELECT id FROM financial_entities WHERE id = ?').bind(entities[0]).first(), null);
});

test('Dominio: exportación completa entrega manifiesto y originales verificados de forma incremental', async () => {
  const entity = await createEntity(db, alice);
  const receipts = [
    await recordSource(db, bucket, alice, entity.id, 'export-abc', bytes('abc')),
    await recordSource(db, bucket, alice, entity.id, 'export-def', bytes('def')),
  ];
  const reads = [];
  const observed = wrapBucket({ get: async key => { reads.push(key); return bucket.get(key); } });
  const iterator = exportEntityFiles(db, observed, alice, entity.id);

  const first = await iterator.next();
  assert.equal(first.done, false); assert.equal(first.value.path, 'manifest.json');
  assert.equal(first.value.mediaType, 'application/json'); assert.equal(reads.length, 0);
  assert.equal(first.value.byteLength, first.value.bytes.byteLength);
  const manifestDigest = Buffer.from(await crypto.subtle.digest('SHA-256', first.value.bytes)).toString('hex');
  assert.equal(first.value.sha256, manifestDigest);
  const manifestText = new TextDecoder().decode(first.value.bytes);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.format, 'wedge-full-export'); assert.equal(manifest.formatVersion, 1);
  assert.equal(manifest.metadata.entity.id, entity.id);
  assert.deepEqual(manifest.summary, { originalCount: 2, originalBytes: 6 });
  assert.deepEqual(manifest.originals.map(file => file.sha256), receipts.map(row => row.sha256).sort());
  assert.equal(manifestText.includes('object_key'), false);
  assert.equal(manifestText.includes(`entities/${entity.id}/sources/`), false);

  const expected = new Map([[receipts[0].sha256, bytes('abc')], [receipts[1].sha256, bytes('def')]]);
  const originals = [];
  for await (const file of iterator) {
    originals.push(file);
    assert.equal(reads.length, originals.length);
    assert.deepEqual(file.bytes, expected.get(file.sha256));
    assert.equal(file.path, `sources/${file.sha256}.xml`);
    assert.equal(file.mediaType, 'application/xml'); assert.equal(file.byteLength, 3);
  }
  assert.equal(originals.length, 2);
});

test('Dominio: el manifiesto fija una foto y excluye fuentes recibidas después', async () => {
  const entity = await createEntity(db, alice);
  const included = await recordSource(db, bucket, alice, entity.id, 'snapshot-included', bytes('abc'));
  const iterator = exportEntityFiles(db, bucket, alice, entity.id);
  const first = await iterator.next();
  const manifest = JSON.parse(new TextDecoder().decode(first.value.bytes));
  const later = await recordSource(db, bucket, alice, entity.id, 'snapshot-later', bytes('def'));
  const originals = [];
  for await (const file of iterator) originals.push(file);
  assert.deepEqual(manifest.originals.map(file => file.sha256), [included.sha256]);
  assert.deepEqual(originals.map(file => file.sha256), [included.sha256]);
  assert.notEqual(later.sha256, included.sha256);
});

test('Dominio: exportación completa rechaza originales ausentes e intentos pendientes', async () => {
  const metadataOnly = await createEntity(db, alice);
  await db.prepare(`INSERT INTO source_artifacts (entity_id, sha256, byte_length, created_at)
    VALUES (?, ?, 3, '2026-09-14')`).bind(metadataOnly.id, '1'.repeat(64)).run();
  await assert.rejects(exportEntityFiles(db, bucket, alice, metadataOnly.id).next(), code('export_incomplete'));

  const pending = await createEntity(db, alice);
  const unavailable = wrapBucket({ put: async () => { throw new Error('synthetic R2 detail'); } });
  await assert.rejects(recordSource(db, unavailable, alice, pending.id, 'export-pending', bytes('abc')), code('storage_error'));
  await assert.rejects(exportEntityFiles(db, bucket, alice, pending.id).next(), code('export_incomplete'));
});

test('Dominio: exportación aborta si R2 está alterado o el acceso se revoca durante la lectura', async () => {
  const corrupt = await createEntity(db, alice);
  const damaged = await recordSource(db, bucket, alice, corrupt.id, 'export-corrupt', bytes('abc'));
  await bucket.put(objectPath(corrupt.id, damaged.sha256), bytes('damaged'));
  const corruptExport = exportEntityFiles(db, bucket, alice, corrupt.id);
  assert.equal((await corruptExport.next()).value.path, 'manifest.json');
  await assert.rejects(corruptExport.next(), code('storage_error'));

  const revoked = await createEntity(db, alice);
  await recordSource(db, bucket, alice, revoked.id, 'export-revoked', bytes('abc'));
  let enterGet, releaseGet;
  const entered = new Promise(resolve => { enterGet = resolve; });
  const release = new Promise(resolve => { releaseGet = resolve; });
  const delayed = wrapBucket({ get: async key => { enterGet(); await release; return bucket.get(key); } });
  const revokedExport = exportEntityFiles(db, delayed, alice, revoked.id);
  assert.equal((await revokedExport.next()).value.path, 'manifest.json');
  const original = revokedExport.next();
  await entered;
  await db.prepare('DELETE FROM entity_memberships WHERE entity_id = ? AND user_id = ?')
    .bind(revoked.id, alice.userId).run();
  releaseGet();
  await assert.rejects(original, code('not_found'));
});

test('Dominio: el mismo comando completa un recibo metadata_only anterior a R2', async () => {
  const before = await exportEntity(db, alice, 'synthetic-precloud');
  assert.equal(before.sources[0].storage_state, 'metadata_only');
  const receipt = await recordSource(db, bucket, alice, 'synthetic-precloud', 'legacy', bytes('abc'));
  assert.equal(receipt.received_at, '2026-09-14');
  const after = await exportEntity(db, alice, 'synthetic-precloud');
  assert.equal(after.sources[0].storage_state, 'stored');
  assert.equal(after.receipts.length, 1); assert.equal(after.audit.length, 1);
  assert.deepEqual((await readSource(db, bucket, alice, 'synthetic-precloud', hashAbc)).bytes, bytes('abc'));
});

test('Dominio: otra cuenta no lee, importa ni borra; ausencia devuelve el mismo error', async () => {
  const entity = await createEntity(db, alice);
  const receipt = await recordSource(db, bucket, alice, entity.id, 'private', bytes('abc'));
  const before = await exportEntity(db, alice, entity.id);
  for (const id of [entity.id, 'unknown-entity']) {
    await assert.rejects(exportEntity(db, bob, id), code('not_found'));
    await assert.rejects(recordSource(db, bucket, bob, id, 'forged', bytes('abc')), code('not_found'));
    await assert.rejects(eraseEntity(db, bucket, bob, id), code('not_found'));
  }
  assert.equal(await hasEntityDeletionTombstone(bucket, entity.id), false);
  await assert.rejects(readSource(db, bucket, bob, entity.id, receipt.sha256), code('not_found'));
  assert.deepEqual(await exportEntity(db, alice, entity.id), before);
});

test('Dominio: reintentos concurrentes son idempotentes y una nueva recepción conserva el intento', async () => {
  const entity = await createEntity(db, alice);
  const results = await Promise.all(Array.from({ length: 5 }, () => recordSource(db, bucket, alice, entity.id, 'retry', bytes('abc'))));
  for (const result of results) assert.deepEqual(result, results[0]);
  assert.deepEqual(await recordSource(db, bucket, alice, entity.id, 'retry', bytes('abc')), results[0]);
  let data = await exportEntity(db, alice, entity.id);
  assert.equal(data.sources.length, 1); assert.equal(data.receipts.length, 1); assert.equal(data.audit.length, 2);
  await recordSource(db, bucket, alice, entity.id, 'another-attempt', bytes('abc'));
  data = await exportEntity(db, alice, entity.id);
  assert.equal(data.sources.length, 1); assert.equal(data.receipts.length, 2); assert.equal(data.audit.length, 3);
});

test('Dominio: comando concurrente con bytes distintos rechaza uno sin fuentes huérfanas', async () => {
  const entity = await createEntity(db, alice);
  const results = await Promise.allSettled(['abc', 'different'].map(text => recordSource(db, bucket, alice, entity.id, 'same-key', bytes(text))));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'command_conflict');
  const data = await exportEntity(db, alice, entity.id);
  assert.equal(data.sources.length, 1); assert.equal(data.receipts.length, 1); assert.equal(data.audit.length, 2);
  assert.equal(data.sources[0].sha256, data.receipts[0].sha256);
  const before = structuredClone(data);
  const other = data.sources[0].sha256 === hashAbc ? 'different' : 'abc';
  await assert.rejects(recordSource(db, bucket, alice, entity.id, 'same-key', bytes(other)), code('command_conflict'));
  assert.deepEqual(await exportEntity(db, alice, entity.id), before);
});

test('Dominio: fallo de auditoría deja intento reintentable y oculta el error SQL', async () => {
  const entity = await createEntity(db, alice);
  await db.prepare("CREATE TRIGGER synthetic_failure BEFORE INSERT ON audit_events WHEN NEW.kind = 'source_received' BEGIN SELECT RAISE(ABORT, 'synthetic provider detail'); END").run();
  try { await assert.rejects(recordSource(db, bucket, alice, entity.id, 'fail', bytes('abc')), code('storage_error')); }
  finally { await db.prepare('DROP TRIGGER synthetic_failure').run(); }
  let after = await exportEntity(db, alice, entity.id);
  assert.equal(after.sources.length, 0); assert.equal(after.receipts.length, 0); assert.equal(after.pendingUploads.length, 1);
  await recordSource(db, bucket, alice, entity.id, 'fail', bytes('abc'));
  after = await exportEntity(db, alice, entity.id);
  assert.equal(after.sources.length, 1); assert.equal(after.receipts.length, 1); assert.equal(after.pendingUploads.length, 0);
});

test('Dominio: fallo de R2 deja intención trazable y un reintento la completa', async () => {
  const entity = await createEntity(db, alice);
  const unavailable = wrapBucket({ put: async () => { throw new Error('synthetic R2 detail'); } });
  await assert.rejects(recordSource(db, unavailable, alice, entity.id, 'r2-retry', bytes('abc')), code('storage_error'));
  let data = await exportEntity(db, alice, entity.id);
  assert.equal(data.sources.length, 0); assert.equal(data.receipts.length, 0); assert.equal(data.pendingUploads.length, 1);
  assert.equal('object_key' in data.pendingUploads[0], false);
  await recordSource(db, bucket, alice, entity.id, 'r2-retry', bytes('abc'));
  data = await exportEntity(db, alice, entity.id);
  assert.equal(data.sources.length, 1); assert.equal(data.receipts.length, 1); assert.equal(data.pendingUploads.length, 0);
});

test('Dominio: lectura verifica bytes de R2 contra tamaño y SHA-256 de D1', async () => {
  const entity = await createEntity(db, alice);
  const receipt = await recordSource(db, bucket, alice, entity.id, 'integrity', bytes('abc'));
  await bucket.put(objectPath(entity.id, receipt.sha256), bytes('xyz'), {
    httpMetadata: { contentType: 'application/xml' },
    customMetadata: { sha256: receipt.sha256, format: 'wedge-source-v1' },
  });
  await assert.rejects(readSource(db, bucket, alice, entity.id, receipt.sha256), code('storage_error'));
  await assert.rejects(recordSource(db, bucket, alice, entity.id, 'integrity-retry', bytes('abc')), code('storage_error'));
  await assert.rejects(readSource(db, bucket, alice, entity.id, 'A'.repeat(64)), code('invalid_input'));
});

test('Dominio: un borrado R2 fallido queda visible y se puede reintentar', async () => {
  const entity = await createEntity(db, alice);
  const receipt = await recordSource(db, bucket, alice, entity.id, 'delete-retry', bytes('abc'));
  const unavailable = wrapBucket({ delete: async () => { throw new Error('synthetic R2 delete detail'); } });
  await assert.rejects(eraseEntity(db, unavailable, alice, entity.id), code('storage_error'));
  const pending = await exportEntity(db, alice, entity.id);
  assert.equal(pending.entity.state, 'deleting'); assert.equal(pending.sources[0].storage_state, 'deleting');
  assert.equal(await hasEntityDeletionTombstone(bucket, entity.id), true);
  await assert.rejects(exportEntityFiles(db, bucket, alice, entity.id).next(), code('not_found'));
  await assert.rejects(readSource(db, bucket, alice, entity.id, receipt.sha256), code('not_found'));
  await eraseEntity(db, bucket, alice, entity.id);
  assert.equal(await bucket.head(objectPath(entity.id, receipt.sha256)), null);
  await assert.rejects(exportEntity(db, alice, entity.id), code('not_found'));
});

test('Dominio: un fallo al registrar el tombstone bloquea acceso y conserva originales para reintento', async () => {
  const entity = await createEntity(db, alice);
  const receipt = await recordSource(db, bucket, alice, entity.id, 'registry-retry', bytes('abc'));
  const unavailable = wrapBucket({ put: async key => {
    if (key.startsWith(DELETION_TOMBSTONE_PREFIX)) throw new Error('synthetic registry detail');
    throw new Error('unexpected put');
  } });
  await assert.rejects(eraseEntity(db, unavailable, alice, entity.id), code('storage_error'));
  assert.equal((await exportEntity(db, alice, entity.id)).entity.state, 'deleting');
  assert.notEqual(await bucket.head(objectPath(entity.id, receipt.sha256)), null);
  assert.equal(await hasEntityDeletionTombstone(bucket, entity.id), false);
  await eraseEntity(db, bucket, alice, entity.id);
  assert.equal(await hasEntityDeletionTombstone(bucket, entity.id), true);
  assert.equal(await bucket.head(objectPath(entity.id, receipt.sha256)), null);
});

test('Dominio: tombstone mínimo no revela el UUID y sobrevive una restauración D1 sintética', async () => {
  assert.equal(DELETION_TOMBSTONE_RETENTION_DAYS, 45);
  const untouched = await createEntity(db, alice);
  assert.deepEqual(await reconcileRestoredEntityDeletion(db, bucket, untouched.id),
    { entityId: untouched.id, status: 'retained', objectsRemoved: 0 });
  assert.equal((await exportEntity(db, alice, untouched.id)).entity.state, 'active');

  const entity = await createEntity(db, alice);
  await eraseEntity(db, bucket, alice, entity.id);
  const path = await tombstonePath(entity.id);
  const page = await bucket.list({ prefix: DELETION_TOMBSTONE_PREFIX });
  assert.ok(page.objects.some(object => object.key === path));
  assert.equal(path.includes(entity.id), false);
  const object = await bucket.get(path);
  assert.equal(object.size, 0); assert.equal((await object.arrayBuffer()).byteLength, 0);
  assert.equal(object.httpMetadata.contentType, 'application/octet-stream');
  assert.equal(object.httpMetadata.cacheControl, 'no-store');
  assert.deepEqual(object.customMetadata, { format: 'wedge-deletion-v1' });

  // Simula que Time Travel revivió la entidad sin tocar el registro independiente en R2.
  await db.prepare('INSERT INTO financial_entities (id, created_at) VALUES (?, ?)')
    .bind(entity.id, entity.createdAt).run();
  const restoredOrphan = objectPath(entity.id, hashAbc);
  await bucket.put(restoredOrphan, bytes('restored-orphan'));
  assert.equal(await hasEntityDeletionTombstone(bucket, entity.id), true);
  assert.deepEqual(await reconcileRestoredEntityDeletion(db, bucket, entity.id),
    { entityId: entity.id, status: 'removed', objectsRemoved: 1 });
  assert.equal(await db.prepare('SELECT id FROM financial_entities WHERE id = ?').bind(entity.id).first(), null);
  assert.equal(await bucket.head(restoredOrphan), null);
  assert.equal(await hasEntityDeletionTombstone(bucket, entity.id), true);

  await bucket.put(restoredOrphan, bytes('late-orphan'));
  assert.deepEqual(await reconcileRestoredEntityDeletion(db, bucket, entity.id),
    { entityId: entity.id, status: 'absent', objectsRemoved: 1 });
  assert.equal(await bucket.head(restoredOrphan), null);
});

test('Dominio: el registro de borrados puede vivir fuera del bucket de originales', async () => {
  const entity = await createEntity(db, alice);
  await recordSource(db, bucket, alice, entity.id, 'external-registry', bytes('abc'));
  const recorded = new Set();
  const registry = {
    has: async id => recorded.has(id),
    ensure: async id => { recorded.add(id); },
  };
  await eraseEntity(db, bucket, alice, entity.id, registry);
  assert.equal(recorded.has(entity.id), true);
  assert.equal(await bucket.get(await tombstonePath(entity.id)), null);
  assert.equal(await bucket.get(objectPath(entity.id, hashAbc)), null);
});

test('Dominio: un tombstone preexistente alterado impide confirmar el borrado', async () => {
  const entity = await createEntity(db, alice);
  const receipt = await recordSource(db, bucket, alice, entity.id, 'registry-corrupt', bytes('abc'));
  const path = await tombstonePath(entity.id);
  await bucket.put(path, bytes('forged'));
  await assert.rejects(eraseEntity(db, bucket, alice, entity.id), code('storage_error'));
  assert.equal((await exportEntity(db, alice, entity.id)).entity.state, 'deleting');
  assert.notEqual(await bucket.head(objectPath(entity.id, receipt.sha256)), null);
  await assert.rejects(hasEntityDeletionTombstone(bucket, entity.id), code('storage_error'));
  await bucket.delete(path);
  await eraseEntity(db, bucket, alice, entity.id);
});

test('Dominio: reconciliación paginada recorre una restauración completa con límites', async () => {
  const recoveryDb = await runtime.getD1Database('RECOVERY');
  await migrate(recoveryDb);
  await recoveryDb.prepare('DELETE FROM financial_entities').run();
  const entities = await Promise.all([
    createEntity(recoveryDb, alice), createEntity(recoveryDb, alice), createEntity(recoveryDb, alice),
  ]);
  const deleted = entities[1];
  await eraseEntity(recoveryDb, bucket, alice, deleted.id);
  await recoveryDb.prepare('INSERT INTO financial_entities (id, created_at) VALUES (?, ?)')
    .bind(deleted.id, deleted.createdAt).run();
  const restoredOrphan = objectPath(deleted.id, hashAbc);
  await bucket.put(restoredOrphan, bytes('restored-page-orphan'));

  const totals = { scanned: 0, removed: 0, retained: 0, absent: 0, objectsRemoved: 0 };
  let after;
  do {
    const report = await reconcileRestoredEntityDeletionsPage(recoveryDb, bucket, { after, limit: 1 });
    assert.equal(report.formatVersion, 1);
    for (const field of Object.keys(totals)) totals[field] += report[field];
    after = report.nextCursor ?? undefined;
  } while (after);

  assert.deepEqual(totals, { scanned: 3, removed: 1, retained: 2, absent: 0, objectsRemoved: 1 });
  assert.equal(await recoveryDb.prepare('SELECT id FROM financial_entities WHERE id = ?').bind(deleted.id).first(), null);
  assert.equal((await recoveryDb.prepare('SELECT count(*) AS n FROM financial_entities').first()).n, 2);
  assert.equal(await bucket.head(restoredOrphan), null);
  await assert.rejects(reconcileRestoredEntityDeletionsPage(recoveryDb, bucket, { limit: 0 }), code('invalid_input'));
  await assert.rejects(reconcileRestoredEntityDeletionsPage(recoveryDb, bucket, { limit: 101 }), code('invalid_input'));
  await assert.rejects(reconcileRestoredEntityDeletionsPage(recoveryDb, bucket, { after: '*' }), code('invalid_input'));
});

test('Dominio: borrar durante una carga no deja un objeto huérfano', async () => {
  const entity = await createEntity(db, alice);
  let enterPut, releasePut;
  const entered = new Promise(resolve => { enterPut = resolve; });
  const release = new Promise(resolve => { releasePut = resolve; });
  const delayed = wrapBucket({ put: async (...args) => { enterPut(); await release; return bucket.put(...args); } });
  const upload = recordSource(db, delayed, alice, entity.id, 'upload-delete-race', bytes('abc'));
  await entered;
  await eraseEntity(db, bucket, alice, entity.id);
  releasePut();
  await assert.rejects(upload, code('storage_error'));
  assert.equal(await bucket.head(objectPath(entity.id, hashAbc)), null);
});

test('Dominio: claves compuestas rechazan referencias cruzadas incluso fuera del repositorio', async () => {
  const a = await createEntity(db, alice), b = await createEntity(db, bob);
  await recordSource(db, bucket, alice, a.id, 'local', bytes('abc'));
  await assert.rejects(db.prepare('INSERT INTO import_receipts (entity_id, command_id, sha256, actor_id, received_at) VALUES (?, ?, ?, ?, ?)').bind(b.id, 'cross', hashAbc, bob.userId, '2026-09-14').run(), /FOREIGN KEY/);
  await assert.rejects(db.prepare("INSERT INTO audit_events (entity_id, event_id, kind, command_id, actor_id, occurred_at) VALUES (?, 'cross', 'source_received', 'local', ?, '2026-09-14')").bind(b.id, bob.userId).run(), /FOREIGN KEY/);
  await recordSource(db, bucket, bob, b.id, 'local', bytes('abc'));
  assert.equal((await exportEntity(db, bob, b.id)).sources.length, 1);
  assert.equal((await exportEntity(db, alice, a.id)).sources.length, 1);
});

test('Dominio: revocar membresía invalida lecturas y escrituras del contexto anterior', async () => {
  const entity = await createEntity(db, alice);
  await db.prepare('DELETE FROM entity_memberships WHERE entity_id = ? AND user_id = ?').bind(entity.id, alice.userId).run();
  await assert.rejects(recordSource(db, bucket, alice, entity.id, 'revoked', bytes('abc')), code('not_found'));
  await assert.rejects(exportEntity(db, alice, entity.id), code('not_found'));
  await assert.rejects(eraseEntity(db, bucket, alice, entity.id), code('not_found'));
});

test('Dominio: borrado alcanza todas las filas activas propias y conserva otras entidades y demo', async () => {
  const a = await createEntity(db, alice), b = await createEntity(db, bob);
  await recordSource(db, bucket, alice, a.id, 'remove', bytes('abc'));
  await recordSource(db, bucket, bob, b.id, 'keep', bytes('abc'));
  const orphan = objectPath(a.id, 'f'.repeat(64));
  await bucket.put(orphan, bytes('synthetic-orphan'));
  const expected = await exportEntity(db, bob, b.id);
  let deletionPages = 0;
  const paged = wrapBucket({ list: options => {
    deletionPages += 1;
    return bucket.list({ ...options, limit: 1 });
  } });
  await eraseEntity(db, paged, alice, a.id);
  assert.equal(deletionPages, 2);
  await assert.rejects(exportEntity(db, alice, a.id), code('not_found'));
  assert.equal(await bucket.head(objectPath(a.id, hashAbc)), null);
  assert.equal(await bucket.head(orphan), null);
  assert.notEqual(await bucket.head(objectPath(b.id, hashAbc)), null);
  for (const table of ['entity_memberships', 'source_artifacts', 'source_objects', 'source_upload_attempts', 'entity_deletions', 'import_receipts', 'audit_events']) {
    assert.equal((await db.prepare(`SELECT count(*) AS n FROM ${table} WHERE entity_id = ?`).bind(a.id).first()).n, 0);
  }
  assert.deepEqual(await exportEntity(db, bob, b.id), expected);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM demo_progress').first()).n, 1);
});

test('Dominio: valida límites antes de escribir y toma copia de los bytes', async () => {
  const entity = await createEntity(db, alice);
  for (const invalid of [new Uint8Array(), new Uint8Array(131073), 'abc', null]) {
    await assert.rejects(recordSource(db, bucket, alice, entity.id, 'invalid', invalid), code('invalid_input'));
  }
  await assert.rejects(recordSource(db, bucket, alice, entity.id, "'; DROP TABLE audit_events;--", bytes('abc')), code('invalid_input'));
  await assert.rejects(createEntity(db, { userId: '' }), code('invalid_input'));
  assert.equal((await exportEntity(db, alice, entity.id)).sources.length, 0);
  const mutable = bytes('abc');
  const pending = recordSource(db, bucket, alice, entity.id, 'snapshot', mutable);
  mutable.fill(0);
  assert.equal((await pending).sha256, hashAbc);
  await recordSource(db, bucket, alice, entity.id, 'limit', new Uint8Array(131072));
});

test('Dominio: limita fuentes distintas por entidad pero permite completar una ya conocida', async () => {
  const entity = await createEntity(db, alice);
  await db.prepare(`WITH RECURSIVE n(value) AS (SELECT 1 UNION ALL SELECT value + 1 FROM n WHERE value < ?)
    INSERT INTO source_artifacts (entity_id, sha256, byte_length, created_at)
    SELECT ?, CASE WHEN value = 1 THEN ? ELSE printf('%064x', value) END, 3, '2026-09-14' FROM n`).bind(MAX_SOURCES_PER_ENTITY, entity.id, hashAbc).run();
  await assert.rejects(recordSource(db, bucket, alice, entity.id, 'over-limit', bytes('new')), code('limit_exceeded'));
  assert.equal((await exportEntity(db, alice, entity.id)).pendingUploads.length, 0);
  await recordSource(db, bucket, alice, entity.id, 'known', bytes('abc'));
  assert.equal((await readSource(db, bucket, alice, entity.id, hashAbc)).sha256, hashAbc);
});

test('Dominio: auditoría paginada verifica contenido sano sin exponer bytes', async () => {
  const entity = await createEntity(db, alice);
  await recordSource(db, bucket, alice, entity.id, 'audit-abc', bytes('abc'));
  await recordSource(db, bucket, alice, entity.id, 'audit-def', bytes('def'));
  const metadata = await auditEntityStorage(db, bucket, alice, entity.id);
  assert.equal(metadata.status, 'consistent'); assert.equal(metadata.mode, 'metadata');
  assert.equal(metadata.counts.contentChecked, 0);
  const paged = wrapBucket({ list: options => bucket.list({ ...options, limit: 1 }) });
  const report = await auditEntityStorage(db, paged, alice, entity.id, { verifyBytes: true });
  assert.equal(report.status, 'consistent'); assert.equal(report.mode, 'content');
  assert.deepEqual(report.counts, { sourceObjects: 2, pendingObjects: 0, bucketObjects: 2, contentChecked: 2 });
  assert.deepEqual(report.findings, []); assert.equal('bytes' in report, false);
});

test('Dominio: auditoría distingue faltante, alterado, huérfano e intento pendiente', async () => {
  const entity = await createEntity(db, alice);
  const missing = await recordSource(db, bucket, alice, entity.id, 'audit-missing', bytes('abc'));
  const corrupt = await recordSource(db, bucket, alice, entity.id, 'audit-corrupt', bytes('def'));
  const wrongMetadata = await recordSource(db, bucket, alice, entity.id, 'audit-metadata', bytes('jkl'));
  await bucket.delete(objectPath(entity.id, missing.sha256));
  await bucket.put(objectPath(entity.id, corrupt.sha256), bytes('wxyz'), {
    httpMetadata: { contentType: 'application/xml' },
    customMetadata: { sha256: corrupt.sha256, format: 'wedge-source-v1' },
  });
  await bucket.put(objectPath(entity.id, wrongMetadata.sha256), bytes('jkl'));
  const orphanHash = 'f'.repeat(64);
  await bucket.put(objectPath(entity.id, orphanHash), bytes('orphan'));
  const unavailable = wrapBucket({ put: async () => { throw new Error('synthetic R2 detail'); } });
  await assert.rejects(recordSource(db, unavailable, alice, entity.id, 'audit-pending', bytes('ghi')), code('storage_error'));
  await db.prepare(`INSERT INTO source_upload_attempts
    (entity_id, command_id, sha256, byte_length, object_key, actor_id, started_at)
    VALUES (?, 'synthetic-conflict', ?, 4, ?, ?, '2026-09-14')`)
    .bind(entity.id, missing.sha256, objectPath(entity.id, missing.sha256), alice.userId).run();

  const report = await auditEntityStorage(db, bucket, alice, entity.id, { verifyBytes: true });
  assert.equal(report.status, 'inconsistent'); assert.equal(report.counts.pendingObjects, 2);
  assert.deepEqual(report.findings.map(f => f.kind), [
    'hash_mismatch', 'metadata_mismatch', 'missing_object', 'size_mismatch', 'tracking_conflict', 'unexpected_object',
  ]);
  assert.deepEqual(report.findings.map(f => f.sha256), [
    corrupt.sha256, wrongMetadata.sha256, missing.sha256, corrupt.sha256, missing.sha256, orphanHash,
  ]);
});

test('Dominio: auditoría autoriza antes de listar y oculta fallos del proveedor', async () => {
  const entity = await createEntity(db, alice);
  let listed = false;
  const unavailable = wrapBucket({ list: async () => { listed = true; throw new Error('synthetic provider detail'); } });
  await assert.rejects(auditEntityStorage(db, unavailable, bob, entity.id), code('not_found'));
  assert.equal(listed, false);
  await assert.rejects(auditEntityStorage(db, unavailable, alice, entity.id), code('storage_error'));
  assert.equal(listed, true);
  await assert.rejects(auditEntityStorage(db, bucket, alice, entity.id, { verifyBytes: 'yes' }), code('invalid_input'));
});

test('Dominio: auditoría vuelve a autorizar antes de devolver el informe', async () => {
  const entity = await createEntity(db, alice);
  await recordSource(db, bucket, alice, entity.id, 'audit-revoke', bytes('abc'));
  let enterList, releaseList;
  const entered = new Promise(resolve => { enterList = resolve; });
  const release = new Promise(resolve => { releaseList = resolve; });
  const delayed = wrapBucket({ list: async options => { enterList(); await release; return bucket.list(options); } });
  const report = auditEntityStorage(db, delayed, alice, entity.id);
  await entered;
  await db.prepare('DELETE FROM entity_memberships WHERE entity_id = ? AND user_id = ?').bind(entity.id, alice.userId).run();
  releaseList();
  await assert.rejects(report, code('not_found'));
});

test('Dominio: acceso por entidad utiliza índices; la migración conserva demo y permite reversión sintética', async () => {
  const plan = await db.prepare('EXPLAIN QUERY PLAN SELECT * FROM source_artifacts WHERE entity_id = ? ORDER BY sha256').bind('synthetic').all();
  assert.ok(plan.results.some(row => /SEARCH source_artifacts USING INDEX/.test(row.detail)));
  const copy = await runtime.getD1Database('ROLLBACK');
  await migrate(copy);
  const e = await createEntity(copy, alice);
  await recordSource(copy, bucket, alice, e.id, 'rollback', bytes('abc'));
  assert.notEqual(await bucket.head(objectPath(e.id, hashAbc)), null);
  await eraseEntity(copy, bucket, alice, e.id);
  assert.equal(await bucket.head(objectPath(e.id, hashAbc)), null);
  for (const table of ['audit_events', 'import_receipts', 'source_upload_attempts', 'source_objects', 'entity_deletions', 'source_artifacts', 'entity_memberships', 'financial_entities']) await copy.prepare(`DROP TABLE ${table}`).run();
  assert.equal((await copy.prepare('SELECT count(*) AS n FROM demo_progress').first()).n, 1);
  assert.equal((await copy.prepare('PRAGMA foreign_key_check').all()).results.length, 0);
});
