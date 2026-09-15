import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Miniflare } from 'miniflare';
import { createEntity, recordSource, exportEntity, eraseEntity } from '../../packages/domain/repository.ts';

// Real D1 semantics in an isolated local runtime. No HTTP route or real tax data.
const alice = { userId: 'synthetic-alice' }, bob = { userId: 'synthetic-bob' };
const bytes = text => new TextEncoder().encode(text);
const hashAbc = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const code = expected => error => error.code === expected && error.message === expected;
let runtime, db;
async function migrate(target) {
  for (const file of (await readdir('drizzle')).filter(f => f.endsWith('.sql')).sort()) {
    if (file.startsWith('0005_')) {
      await target.prepare("INSERT INTO demo_progress (user_id, stage, resolved, version, updated_at) VALUES ('synthetic-demo', 'draft', '[]', 0, '2026-09-14')").run();
    }
    const sql = await readFile(join('drizzle', file), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)) await target.prepare(statement).run();
  }
}
before(async () => {
  runtime = new Miniflare({ cf: false, modules: true,
    script: 'export default { fetch() { return new Response("synthetic"); } };',
    compatibilityDate: '2026-05-15', d1Databases: ['DB', 'ROLLBACK'],
  });
  db = await runtime.getD1Database('DB');
  await migrate(db);
  assert.equal((await db.prepare("SELECT stage FROM demo_progress WHERE user_id = 'synthetic-demo'").first()).stage, 'draft');
}, { timeout: 20000 });
after(async () => { await runtime?.dispose(); });

test('Dominio: exporta actor y SHA-256 de bytes originales sin afirmar almacenamiento del archivo', async () => {
  const entity = await createEntity(db, alice);
  const receipt = await recordSource(db, alice, entity.id, 'first', bytes('abc'));
  const exported = await exportEntity(db, alice, entity.id);
  assert.equal(exported.formatVersion, 1);
  assert.equal(receipt.sha256, hashAbc);
  assert.equal(receipt.actor_id, alice.userId);
  assert.equal(exported.sources[0].storage_state, 'metadata_only');
  assert.equal(exported.sources[0].byte_length, 3);
  assert.deepEqual(exported.receipts, [receipt]);
  assert.deepEqual(exported.audit.map(e => e.kind), ['entity_created', 'source_received']);
  assert.equal(exported.audit[1].actor_id, alice.userId);
  assert.equal(exported.audit[1].occurred_at, receipt.received_at);
});

test('Dominio: otra cuenta no lee, importa ni borra; ausencia devuelve el mismo error', async () => {
  const entity = await createEntity(db, alice);
  const before = await exportEntity(db, alice, entity.id);
  for (const id of [entity.id, 'unknown-entity']) {
    await assert.rejects(exportEntity(db, bob, id), code('not_found'));
    await assert.rejects(recordSource(db, bob, id, 'forged', bytes('abc')), code('not_found'));
    await assert.rejects(eraseEntity(db, bob, id), code('not_found'));
  }
  assert.deepEqual(await exportEntity(db, alice, entity.id), before);
});

test('Dominio: reintentos concurrentes son idempotentes y una nueva recepción conserva el intento', async () => {
  const entity = await createEntity(db, alice);
  const results = await Promise.all(Array.from({ length: 5 }, () => recordSource(db, alice, entity.id, 'retry', bytes('abc'))));
  for (const result of results) assert.deepEqual(result, results[0]);
  let data = await exportEntity(db, alice, entity.id);
  assert.equal(data.sources.length, 1); assert.equal(data.receipts.length, 1); assert.equal(data.audit.length, 2);
  await recordSource(db, alice, entity.id, 'another-attempt', bytes('abc'));
  data = await exportEntity(db, alice, entity.id);
  assert.equal(data.sources.length, 1); assert.equal(data.receipts.length, 2); assert.equal(data.audit.length, 3);
});

test('Dominio: comando concurrente con bytes distintos rechaza uno sin fuentes huérfanas', async () => {
  const entity = await createEntity(db, alice);
  const results = await Promise.allSettled(['abc', 'different'].map(text => recordSource(db, alice, entity.id, 'same-key', bytes(text))));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'command_conflict');
  const data = await exportEntity(db, alice, entity.id);
  assert.equal(data.sources.length, 1); assert.equal(data.receipts.length, 1); assert.equal(data.audit.length, 2);
  assert.equal(data.sources[0].sha256, data.receipts[0].sha256);
  const before = structuredClone(data);
  const other = data.sources[0].sha256 === hashAbc ? 'different' : 'abc';
  await assert.rejects(recordSource(db, alice, entity.id, 'same-key', bytes(other)), code('command_conflict'));
  assert.deepEqual(await exportEntity(db, alice, entity.id), before);
});

test('Dominio: fallo de auditoría revierte fuente y recepción y oculta el error SQL', async () => {
  const entity = await createEntity(db, alice);
  const before = await exportEntity(db, alice, entity.id);
  await db.prepare("CREATE TRIGGER synthetic_failure BEFORE INSERT ON audit_events WHEN NEW.kind = 'source_received' BEGIN SELECT RAISE(ABORT, 'synthetic provider detail'); END").run();
  try { await assert.rejects(recordSource(db, alice, entity.id, 'fail', bytes('abc')), code('storage_error')); }
  finally { await db.prepare('DROP TRIGGER synthetic_failure').run(); }
  assert.deepEqual(await exportEntity(db, alice, entity.id), before);
});

test('Dominio: claves compuestas rechazan referencias cruzadas incluso fuera del repositorio', async () => {
  const a = await createEntity(db, alice), b = await createEntity(db, bob);
  await recordSource(db, alice, a.id, 'local', bytes('abc'));
  await assert.rejects(db.prepare('INSERT INTO import_receipts (entity_id, command_id, sha256, actor_id, received_at) VALUES (?, ?, ?, ?, ?)').bind(b.id, 'cross', hashAbc, bob.userId, '2026-09-14').run(), /FOREIGN KEY/);
  await assert.rejects(db.prepare("INSERT INTO audit_events (entity_id, event_id, kind, command_id, actor_id, occurred_at) VALUES (?, 'cross', 'source_received', 'local', ?, '2026-09-14')").bind(b.id, bob.userId).run(), /FOREIGN KEY/);
  await recordSource(db, bob, b.id, 'local', bytes('abc'));
  assert.equal((await exportEntity(db, bob, b.id)).sources.length, 1);
  assert.equal((await exportEntity(db, alice, a.id)).sources.length, 1);
});

test('Dominio: revocar membresía invalida lecturas y escrituras del contexto anterior', async () => {
  const entity = await createEntity(db, alice);
  await db.prepare('DELETE FROM entity_memberships WHERE entity_id = ? AND user_id = ?').bind(entity.id, alice.userId).run();
  await assert.rejects(recordSource(db, alice, entity.id, 'revoked', bytes('abc')), code('not_found'));
  await assert.rejects(exportEntity(db, alice, entity.id), code('not_found'));
  await assert.rejects(eraseEntity(db, alice, entity.id), code('not_found'));
});

test('Dominio: borrado alcanza todas las filas activas propias y conserva otras entidades y demo', async () => {
  const a = await createEntity(db, alice), b = await createEntity(db, bob);
  await recordSource(db, alice, a.id, 'remove', bytes('abc'));
  await recordSource(db, bob, b.id, 'keep', bytes('abc'));
  const expected = await exportEntity(db, bob, b.id);
  await eraseEntity(db, alice, a.id);
  await assert.rejects(exportEntity(db, alice, a.id), code('not_found'));
  for (const table of ['entity_memberships', 'source_artifacts', 'import_receipts', 'audit_events']) {
    assert.equal((await db.prepare(`SELECT count(*) AS n FROM ${table} WHERE entity_id = ?`).bind(a.id).first()).n, 0);
  }
  assert.deepEqual(await exportEntity(db, bob, b.id), expected);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM demo_progress').first()).n, 1);
});

test('Dominio: valida límites antes de escribir y toma copia de los bytes', async () => {
  const entity = await createEntity(db, alice);
  for (const invalid of [new Uint8Array(), new Uint8Array(131073), 'abc', null]) {
    await assert.rejects(recordSource(db, alice, entity.id, 'invalid', invalid), code('invalid_input'));
  }
  await assert.rejects(recordSource(db, alice, entity.id, "'; DROP TABLE audit_events;--", bytes('abc')), code('invalid_input'));
  await assert.rejects(createEntity(db, { userId: '' }), code('invalid_input'));
  assert.equal((await exportEntity(db, alice, entity.id)).sources.length, 0);
  const mutable = bytes('abc');
  const pending = recordSource(db, alice, entity.id, 'snapshot', mutable);
  mutable.fill(0);
  assert.equal((await pending).sha256, hashAbc);
  await recordSource(db, alice, entity.id, 'limit', new Uint8Array(131072));
});

test('Dominio: acceso por entidad utiliza índices; la migración conserva demo y permite reversión sintética', async () => {
  const plan = await db.prepare('EXPLAIN QUERY PLAN SELECT * FROM source_artifacts WHERE entity_id = ? ORDER BY sha256').bind('synthetic').all();
  assert.ok(plan.results.some(row => /SEARCH source_artifacts USING INDEX/.test(row.detail)));
  const copy = await runtime.getD1Database('ROLLBACK');
  await migrate(copy);
  const e = await createEntity(copy, alice);
  await recordSource(copy, alice, e.id, 'rollback', bytes('abc'));
  for (const table of ['audit_events', 'import_receipts', 'source_artifacts', 'entity_memberships', 'financial_entities']) await copy.prepare(`DROP TABLE ${table}`).run();
  assert.equal((await copy.prepare('SELECT count(*) AS n FROM demo_progress').first()).n, 1);
  assert.equal((await copy.prepare('PRAGMA foreign_key_check').all()).results.length, 0);
});
