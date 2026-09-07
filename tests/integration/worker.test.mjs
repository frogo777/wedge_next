import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Miniflare } from 'miniflare';

// Synthetic identities model Sites dispatch. This does not test ChatGPT sign-in.
// No production URL, database, credentials or browser is used.
const origin = 'http://wedge.integration.test';
let runtime, directory;
function createRuntime() {
  return new Miniflare({
    cf: false, modules: true,
    scriptPath: resolve('dist/server/index.js'), modulesRoot: resolve('dist/server'),
    modulesRules: [{ type: 'ESModule', include: ['**/*.js'], fallthrough: true }],
    compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'],
    d1Databases: { DB: 'wedge-isolated-integration' }, d1Persist: directory,
    assets: { directory: resolve('dist/client'), routerConfig: { has_user_worker: true } },
  });
}
function request(path, user, options = {}) {
  return runtime.dispatchFetch(origin + path, {
    ...options, redirect: 'manual',
    headers: { ...(user ? { 'oai-authenticated-user-id': user } : {}), ...options.headers },
  });
}
async function state(user) {
  const response = await request('/api/progress', user);
  assert.equal(response.status, 200);
  return (await response.json()).state;
}
async function write(user, current, event) {
  return request('/api/progress', user, {
    method: 'POST', headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, version: current.version, revision: current.revision }),
  });
}
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'wedge-worker-integration-'));
  runtime = createRuntime(); await runtime.ready;
  const db = await runtime.getD1Database('DB');
  for (const file of (await readdir('drizzle')).filter(f => f.endsWith('.sql')).sort()) {
    const sql = await readFile(join('drizzle', file), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)) await db.prepare(statement).run();
  }
}, { timeout: 20000 });
after(async () => {
  if (runtime) await runtime.dispose();
  if (directory) await rm(directory, { recursive: true, force: true });
});

test('Worker: acceso protegido, cabeceras y recursos desplegables', { timeout: 10000 }, async () => {
  const anonymous = await request('/'); assert.equal(anonymous.status, 302);
  assert.equal(anonymous.headers.get('location'), '/signin-with-chatgpt?return_to=%2F');
  assert.equal((await request('/api/progress')).status, 401);
  const page = await request('/', 'test-viewer'); assert.equal(page.status, 200);
  assert.equal(page.headers.get('cache-control'), 'private, no-store');
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  for (const path of ['/conflicts.mjs', '/ledger.mjs', '/ledger-view.mjs', '/app.mjs', '/workflow.mjs', '/document-view.mjs', '/calculator-view.mjs', '/fiscal/resico-isr.mjs', '/style.css', '/favicon.svg']) {
    const asset = await request(path); assert.equal(asset.status, 200, path);
    const body = await asset.text(); assert.ok(body.length > 0, path);
    if (path.endsWith('.mjs')) assert.match(asset.headers.get('content-type'), /javascript/, path);
  }
});
test('Worker: cierre y lectura XML se guardan y exportan por cuenta', { timeout: 10000 }, async () => {
  for (const event of [
    { type: 'ADD_DOCUMENT', id: 'service' },
    { type: 'CONFIRM_COLLECTION', id: 'service', period: '2026-08' },
    { type: 'ADD_DOCUMENT', id: 'conflict' },
    { type: 'CHOOSE_DOCUMENT', id: 'service' },
    { type: 'RESOLVE', id: 'cobro' }, { type: 'RESOLVE', id: 'gasto' },
    ...['REVIEW', 'APPROVE', 'FILE', 'PAY'].map(type => ({ type })),
  ]) {
    const response = await write('journey-a', await state('journey-a'), event);
    assert.equal(response.status, 200, event.type);
  }
  const saved = await state('journey-a'); assert.equal(saved.stage, 'paid');
  assert.equal(saved.documents[0].metadata.total, '6960.00');
  assert.equal(saved.collections[0].amountCents, 696000);assert.equal(saved.decisions[0].sampleId, 'service');
  assert.deepEqual((await state('journey-b')).decisions, []);
  assert.deepEqual((await state('journey-b')).collections, []);
  assert.deepEqual((await state('journey-b')).documents, []);
  const exported = await (await request('/api/progress?export=1&user_id=journey-b', 'journey-a')).json();
  assert.equal(exported.record.userId, 'journey-a'); assert.equal(exported.record.documents.length, 2);assert.equal(exported.record.decisions.length, 1);assert.equal(exported.record.collections.length, 1);
});
test('Worker: D1 rechaza una escritura simultánea sin perder la otra', { timeout: 10000 }, async () => {
  const empty = await state('concurrent');
  const responses = await Promise.all(['cobro', 'gasto'].map(id => write('concurrent', empty, { type: 'RESOLVE', id })));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  assert.equal((await state('concurrent')).resolved.length, 1);
});
test('Worker: borrar y recrear no permite que un estado antiguo modifique el nuevo', { timeout: 10000 }, async () => {
  await write('delete-a', await state('delete-a'), { type: 'ADD_DOCUMENT', id: 'service' });
  const old = await state('delete-a');
  assert.equal((await write('delete-a', old, { type: 'ERASE' })).status, 200);
  assert.equal((await (await request('/api/progress?export=1', 'delete-a')).json()).record, null);
  await write('delete-a', await state('delete-a'), { type: 'RESOLVE', id: 'gasto' });
  assert.equal((await write('delete-a', old, { type: 'ERASE' })).status, 409);
  assert.deepEqual((await state('delete-a')).resolved, ['gasto']);
  assert.equal((await state('journey-a')).stage, 'paid');
});
test('Worker: reiniciar el runtime recupera la base persistida', { timeout: 20000 }, async () => {
  const expected = await state('journey-a');
  await runtime.dispose(); runtime = createRuntime(); await runtime.ready;
  assert.deepEqual(await state('journey-a'), expected);
});
test('Worker: protege origen y rechaza archivos enviados fuera del catálogo', { timeout: 10000 }, async () => {
  const options = { method: 'POST', headers: { origin: 'https://other.test', 'Content-Type': 'application/json' }, body: '{}' };
  assert.equal((await request('/api/progress', 'forged', options)).status, 403);
  options.headers.origin = origin;
  options.body = JSON.stringify({ event: { type: 'ADD_DOCUMENT', id: 'service', xml: '<external/>' }, version: 0, revision: null });
  assert.equal((await request('/api/progress', 'forged', options)).status, 400);
  assert.equal((await state('forged')).version, 0);
});
