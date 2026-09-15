// Server-only entry point. Identity MUST come from authenticated server context.
// No HTTP route uses this module while privacy gates in ADR 0002 remain open.
export type Identity = Readonly<{ userId: string }>;
type Row = Record<string, string | number | null>;
type Failure = 'invalid_input' | 'not_found' | 'command_conflict' | 'limit_exceeded' | 'storage_error';
export class DomainError extends Error {
  readonly code: Failure;
  constructor(code: Failure) { super(code); this.name = 'DomainError'; this.code = code; }
}
function actor(identity: Identity) {
  const id = identity?.userId;
  if (typeof id !== 'string' || !id.trim() || id.length > 256) throw new DomainError('invalid_input');
  return id;
}
function key(value: string) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) throw new DomainError('invalid_input');
  return value;
}
function fingerprint(value: string) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) throw new DomainError('invalid_input');
  return value;
}
async function sha256(bytes: Uint8Array<ArrayBuffer>) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return { digest, hex };
}
async function transact(db: D1Database, statements: D1PreparedStatement[]) {
  try { return await db.batch<Row>(statements); }
  catch { throw new DomainError('storage_error'); }
}
async function queryFirst(db: D1Database, statement: D1PreparedStatement) {
  try { return await statement.first<Row>(); }
  catch { throw new DomainError('storage_error'); }
}
const permitted = `EXISTS (SELECT 1 FROM entity_memberships m WHERE m.entity_id = ? AND m.user_id = ? AND m.role = 'owner')`;
const activeEntity = `NOT EXISTS (SELECT 1 FROM entity_deletions d WHERE d.entity_id = e.id)`;
const sourcePath = (entity: string, hash: string) => `entities/${entity}/sources/${hash}`;
export const MAX_SOURCES_PER_ENTITY = 1000;
export const MAX_STORAGE_AUDIT_OBJECTS = 2000;

export async function createEntity(db: D1Database, identity: Identity) {
  const user = actor(identity), id = crypto.randomUUID(), at = new Date().toISOString();
  await transact(db, [
    db.prepare('INSERT INTO financial_entities (id, created_at) VALUES (?, ?)').bind(id, at),
    db.prepare("INSERT INTO entity_memberships (entity_id, user_id, role) VALUES (?, ?, 'owner')").bind(id, user),
    db.prepare("INSERT INTO audit_events (entity_id, event_id, kind, actor_id, occurred_at) VALUES (?, 'entity_created', 'entity_created', ?, ?)").bind(id, user, at),
  ]);
  return { id, createdAt: at };
}

export async function recordSource(db: D1Database, bucket: R2Bucket, identity: Identity, entityId: string, commandId: string, bytes: Uint8Array) {
  const user = actor(identity), entity = key(entityId), command = key(commandId);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > 131072) throw new DomainError('invalid_input');
  const snapshot = Uint8Array.from(bytes);
  const { digest, hex: hash } = await sha256(snapshot);
  const objectKey = sourcePath(entity, hash), at = new Date().toISOString();

  // Persist intent before touching R2 so an interrupted upload stays attributable and retryable.
  const started = await transact(db, [
    db.prepare(`INSERT INTO source_upload_attempts
      (entity_id, command_id, sha256, byte_length, object_key, actor_id, started_at)
      SELECT ?, ?, ?, ?, ?, ?, ? FROM financial_entities e
      WHERE e.id = ? AND ${activeEntity} AND ${permitted}
      AND NOT EXISTS (SELECT 1 FROM import_receipts r WHERE r.entity_id = ? AND r.command_id = ? AND r.sha256 <> ?)
      AND NOT EXISTS (SELECT 1 FROM import_receipts r JOIN source_objects o
        ON o.entity_id = r.entity_id AND o.sha256 = r.sha256 AND o.state = 'stored'
        WHERE r.entity_id = ? AND r.command_id = ? AND r.sha256 = ?)
      AND (EXISTS (SELECT 1 FROM source_artifacts s WHERE s.entity_id = ? AND s.sha256 = ?)
        OR (SELECT count(*) FROM source_artifacts s WHERE s.entity_id = ?)
          + (SELECT count(DISTINCT u.sha256) FROM source_upload_attempts u WHERE u.entity_id = ?
            AND NOT EXISTS (SELECT 1 FROM source_artifacts s WHERE s.entity_id = u.entity_id AND s.sha256 = u.sha256))
          < ${MAX_SOURCES_PER_ENTITY})
      ON CONFLICT(entity_id, command_id) DO NOTHING`).bind(
        entity, command, hash, snapshot.byteLength, objectKey, user, at,
        entity, entity, user, entity, command, hash, entity, command, hash,
        entity, hash, entity, entity,
      ),
    db.prepare(`SELECT u.sha256, u.byte_length, u.object_key, u.actor_id, u.started_at AS received_at FROM source_upload_attempts u
      JOIN financial_entities e ON e.id = u.entity_id AND ${activeEntity}
      WHERE u.entity_id = ? AND u.command_id = ? AND ${permitted}`).bind(entity, command, entity, user),
    db.prepare(`SELECT r.sha256, r.actor_id, r.received_at,
        CASE WHEN EXISTS (SELECT 1 FROM source_objects o WHERE o.entity_id = r.entity_id
          AND o.sha256 = r.sha256 AND o.state = 'stored') THEN 1 ELSE 0 END AS object_stored
      FROM import_receipts r
      JOIN financial_entities e ON e.id = r.entity_id AND ${activeEntity}
      WHERE r.entity_id = ? AND r.command_id = ? AND ${permitted}
      LIMIT 1`).bind(entity, command, entity, user),
    db.prepare(`SELECT e.id FROM financial_entities e WHERE e.id = ? AND ${activeEntity} AND ${permitted}`).bind(entity, entity, user),
  ]);
  const attempt = started[1].results[0], completed = started[2].results[0];
  if (completed?.sha256 !== undefined && completed.sha256 !== hash) throw new DomainError('command_conflict');
  if (completed?.object_stored === 1) {
    if (typeof completed.actor_id !== 'string' || typeof completed.received_at !== 'string') throw new DomainError('storage_error');
    return { entity_id: entity, command_id: command, sha256: hash,
      actor_id: completed.actor_id, received_at: completed.received_at };
  }
  if (!attempt) throw new DomainError(started[3].results[0] ? 'limit_exceeded' : 'not_found');
  if (attempt.sha256 !== hash) throw new DomainError('command_conflict');
  if (attempt.byte_length !== snapshot.byteLength) throw new DomainError('command_conflict');

  try {
    const stored = await bucket.put(objectKey, snapshot, {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/xml' },
      customMetadata: { sha256: hash, format: 'wedge-source-v1' },
      sha256: digest,
    });
    if (!stored) {
      const existing = await bucket.get(objectKey);
      if (!existing || existing.size !== snapshot.byteLength || existing.customMetadata?.sha256 !== hash
        || existing.customMetadata?.format !== 'wedge-source-v1') throw new DomainError('storage_error');
      if ((await sha256(new Uint8Array(await existing.arrayBuffer()))).hex !== hash) throw new DomainError('storage_error');
    }
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError('storage_error');
  }

  try {
    const finished = await transact(db, [
      db.prepare(`INSERT INTO source_artifacts
        (entity_id, sha256, byte_length, created_at)
        SELECT ?, ?, ?, ? FROM financial_entities e
        WHERE e.id = ? AND ${activeEntity} AND ${permitted}
        AND EXISTS (SELECT 1 FROM source_upload_attempts u WHERE u.entity_id = ? AND u.command_id = ? AND u.sha256 = ? AND u.object_key = ?)
        ON CONFLICT(entity_id, sha256) DO NOTHING`).bind(
            entity, hash, snapshot.byteLength, at,
            entity, entity, user, entity, command, hash, objectKey,
          ),
      db.prepare(`INSERT INTO source_objects (entity_id, sha256, object_key, media_type, state, created_at)
        SELECT u.entity_id, u.sha256, u.object_key, 'application/xml', 'stored', u.started_at FROM source_upload_attempts u
        JOIN source_artifacts s ON s.entity_id = u.entity_id AND s.sha256 = u.sha256 AND s.byte_length = u.byte_length
        JOIN financial_entities e ON e.id = u.entity_id AND ${activeEntity}
        WHERE u.entity_id = ? AND u.command_id = ? AND u.sha256 = ? AND ${permitted}
        ON CONFLICT(entity_id, sha256) DO UPDATE SET state = 'stored'
        WHERE source_objects.object_key = excluded.object_key AND source_objects.media_type = excluded.media_type
          AND source_objects.state <> 'deleting'`).bind(entity, command, hash, entity, user),
      db.prepare(`INSERT INTO import_receipts (entity_id, command_id, sha256, actor_id, received_at)
        SELECT u.entity_id, u.command_id, u.sha256, u.actor_id, u.started_at FROM source_upload_attempts u
        JOIN source_artifacts s ON s.entity_id = u.entity_id AND s.sha256 = u.sha256 AND s.byte_length = u.byte_length
        JOIN source_objects o ON o.entity_id = u.entity_id AND o.sha256 = u.sha256 AND o.object_key = u.object_key
        JOIN financial_entities e ON e.id = u.entity_id AND ${activeEntity}
        WHERE u.entity_id = ? AND u.command_id = ? AND u.sha256 = ?
          AND o.state = 'stored' AND ${permitted}
        ON CONFLICT(entity_id, command_id) DO NOTHING`).bind(entity, command, hash, entity, user),
      db.prepare(`INSERT INTO audit_events (entity_id, event_id, kind, command_id, actor_id, occurred_at)
        SELECT entity_id, 'source:' || command_id, 'source_received', command_id, actor_id, received_at
        FROM import_receipts WHERE entity_id = ? AND command_id = ? AND sha256 = ? AND ${permitted}
        ON CONFLICT(entity_id, event_id) DO NOTHING`).bind(entity, command, hash, entity, user),
      db.prepare(`DELETE FROM source_upload_attempts WHERE entity_id = ? AND command_id = ? AND sha256 = ?
        AND EXISTS (SELECT 1 FROM import_receipts r WHERE r.entity_id = ? AND r.command_id = ? AND r.sha256 = ?)
        AND ${permitted}`).bind(entity, command, hash, entity, command, hash, entity, user),
      db.prepare(`SELECT * FROM import_receipts WHERE entity_id = ? AND command_id = ? AND sha256 = ? AND ${permitted}`).bind(entity, command, hash, entity, user),
    ]);
    const receipt = finished[5].results[0];
    if (!receipt) throw new DomainError('storage_error');
    return receipt;
  } catch (error) {
    // If deletion won the race, no live row can own this key; cleanup is then safe.
    try {
      const lifecycle = await db.prepare(`SELECT e.id, d.entity_id AS deleting FROM financial_entities e
        LEFT JOIN entity_deletions d ON d.entity_id = e.id WHERE e.id = ?`).bind(entity).first<Row>();
      if (!lifecycle || lifecycle.deleting) await bucket.delete(objectKey);
    } catch { /* An active pending row retains enough information for later reconciliation. */ }
    throw error;
  }
}

export async function readSource(db: D1Database, bucket: R2Bucket, identity: Identity, entityId: string, hashValue: string) {
  const user = actor(identity), entity = key(entityId), hash = fingerprint(hashValue);
  const source = await queryFirst(db, db.prepare(`SELECT s.byte_length, o.media_type, o.object_key FROM source_artifacts s
    JOIN source_objects o ON o.entity_id = s.entity_id AND o.sha256 = s.sha256 AND o.state = 'stored'
    JOIN financial_entities e ON e.id = s.entity_id AND ${activeEntity}
    WHERE s.entity_id = ? AND s.sha256 = ? AND ${permitted}`).bind(entity, hash, entity, user));
  if (!source || typeof source.object_key !== 'string') throw new DomainError('not_found');
  try {
    const object = await bucket.get(source.object_key);
    if (!object || object.size !== source.byte_length) throw new DomainError('storage_error');
    const bytes = new Uint8Array(await object.arrayBuffer());
    if ((await sha256(bytes)).hex !== hash) throw new DomainError('storage_error');
    return { bytes, sha256: hash, mediaType: source.media_type as string };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError('storage_error');
  }
}

export async function exportEntity(db: D1Database, identity: Identity, entityId: string) {
  const user = actor(identity), entity = key(entityId);
  const results = await transact(db, [
    db.prepare(`SELECT e.id, CASE WHEN d.entity_id IS NULL THEN 'active' ELSE 'deleting' END AS state, e.created_at
      FROM financial_entities e LEFT JOIN entity_deletions d ON d.entity_id = e.id
      WHERE e.id = ? AND ${permitted}`).bind(entity, entity, user),
    db.prepare(`SELECT entity_id, user_id, role FROM entity_memberships WHERE entity_id = ? AND ${permitted} ORDER BY user_id`).bind(entity, entity, user),
    db.prepare(`SELECT s.entity_id, s.sha256, s.byte_length,
        COALESCE(o.media_type, 'application/xml') AS media_type,
        COALESCE(o.state, s.storage_state) AS storage_state, s.created_at
      FROM source_artifacts s LEFT JOIN source_objects o ON o.entity_id = s.entity_id AND o.sha256 = s.sha256
      WHERE s.entity_id = ? AND ${permitted} ORDER BY s.sha256`).bind(entity, entity, user),
    db.prepare(`SELECT entity_id, command_id, sha256, actor_id, received_at FROM import_receipts
      WHERE entity_id = ? AND ${permitted} ORDER BY command_id`).bind(entity, entity, user),
    db.prepare(`SELECT entity_id, event_id, kind, command_id, actor_id, occurred_at FROM audit_events
      WHERE entity_id = ? AND ${permitted} ORDER BY event_id`).bind(entity, entity, user),
    db.prepare(`SELECT entity_id, command_id, sha256, byte_length, actor_id, started_at FROM source_upload_attempts
      WHERE entity_id = ? AND ${permitted} ORDER BY command_id`).bind(entity, entity, user),
  ]);
  if (!results[0].results[0]) throw new DomainError('not_found');
  return { formatVersion: 2, entity: results[0].results[0], memberships: results[1].results,
    sources: results[2].results, receipts: results[3].results, audit: results[4].results,
    pendingUploads: results[5].results };
}

export async function eraseEntity(db: D1Database, bucket: R2Bucket, identity: Identity, entityId: string) {
  const user = actor(identity), entity = key(entityId), at = new Date().toISOString();
  const started = await transact(db, [
    db.prepare(`INSERT INTO entity_deletions (entity_id, actor_id, started_at)
      SELECT ?, ?, ? FROM financial_entities WHERE id = ? AND ${permitted}
      ON CONFLICT(entity_id) DO NOTHING`).bind(entity, user, at, entity, entity, user),
    db.prepare(`UPDATE source_objects SET state = 'deleting' WHERE entity_id = ? AND ${permitted}`).bind(entity, entity, user),
    db.prepare(`SELECT object_key FROM source_objects WHERE entity_id = ? AND ${permitted}
      UNION SELECT object_key FROM source_upload_attempts WHERE entity_id = ? AND ${permitted}`).bind(entity, entity, user, entity, entity, user),
    db.prepare(`SELECT e.id FROM financial_entities e JOIN entity_deletions d ON d.entity_id = e.id
      WHERE e.id = ? AND ${permitted}`).bind(entity, entity, user),
  ]);
  if (!started[3].results[0]) throw new DomainError('not_found');
  const keys = started[2].results.map(row => row.object_key).filter((value): value is string => typeof value === 'string');
  try {
    for (let offset = 0; offset < keys.length; offset += 1000) await bucket.delete(keys.slice(offset, offset + 1000));
  } catch { throw new DomainError('storage_error'); }
  const [removed] = await transact(db, [
    db.prepare(`DELETE FROM financial_entities WHERE id = ?
      AND EXISTS (SELECT 1 FROM entity_deletions d WHERE d.entity_id = ?)
      AND ${permitted}`).bind(entity, entity, entity, user),
  ]);
  if (removed.meta.changes === 0) throw new DomainError('not_found');
}

type AuditFinding = Readonly<{
  kind: 'hash_mismatch' | 'lifecycle_mismatch' | 'metadata_mismatch' | 'missing_object'
    | 'object_changed_during_scan' | 'size_mismatch' | 'tracking_conflict' | 'unexpected_object';
  objectKey: string;
  sha256: string | null;
}>;

export async function auditEntityStorage(db: D1Database, bucket: R2Bucket, identity: Identity,
  entityId: string, options: Readonly<{ verifyBytes?: boolean }> = {}) {
  const user = actor(identity), entity = key(entityId);
  if (!options || typeof options !== 'object'
    || (options.verifyBytes !== undefined && typeof options.verifyBytes !== 'boolean')) throw new DomainError('invalid_input');
  const verifyBytes = options.verifyBytes === true;
  const results = await transact(db, [
    db.prepare(`SELECT e.id, CASE WHEN d.entity_id IS NULL THEN 'active' ELSE 'deleting' END AS state
      FROM financial_entities e LEFT JOIN entity_deletions d ON d.entity_id = e.id
      WHERE e.id = ? AND ${permitted}`).bind(entity, entity, user),
    db.prepare(`SELECT o.sha256, s.byte_length, o.object_key, o.state
      FROM source_objects o JOIN source_artifacts s ON s.entity_id = o.entity_id AND s.sha256 = o.sha256
      WHERE o.entity_id = ? AND ${permitted} ORDER BY o.object_key LIMIT ${MAX_STORAGE_AUDIT_OBJECTS + 1}`)
      .bind(entity, entity, user),
    db.prepare(`SELECT sha256, byte_length, object_key FROM source_upload_attempts
      WHERE entity_id = ? AND ${permitted}
      GROUP BY sha256, byte_length, object_key ORDER BY object_key LIMIT ${MAX_STORAGE_AUDIT_OBJECTS + 1}`)
      .bind(entity, entity, user),
  ]);
  const entityRow = results[0].results[0];
  if (!entityRow) throw new DomainError('not_found');
  const sources = results[1].results, pending = results[2].results;
  if (sources.length > MAX_STORAGE_AUDIT_OBJECTS || pending.length > MAX_STORAGE_AUDIT_OBJECTS) {
    throw new DomainError('limit_exceeded');
  }

  type Expected = Readonly<{ sha256: string; byteLength: number }>;
  const expected = new Map<string, Expected>(), findings: AuditFinding[] = [];
  for (const row of sources) {
    if (typeof row.object_key !== 'string' || typeof row.sha256 !== 'string' || typeof row.byte_length !== 'number'
      || (row.state !== 'stored' && row.state !== 'deleting')) throw new DomainError('storage_error');
    const phase = row.state;
    expected.set(row.object_key, { sha256: row.sha256, byteLength: row.byte_length });
    if ((entityRow.state === 'active' && phase !== 'stored') || (entityRow.state === 'deleting' && phase !== 'deleting')) {
      findings.push({ kind: 'lifecycle_mismatch', objectKey: row.object_key, sha256: row.sha256 });
    }
  }
  for (const row of pending) {
    if (typeof row.object_key !== 'string' || typeof row.sha256 !== 'string' || typeof row.byte_length !== 'number') {
      throw new DomainError('storage_error');
    }
    const tracked = expected.get(row.object_key);
    if (tracked && (tracked.sha256 !== row.sha256 || tracked.byteLength !== row.byte_length)) {
      findings.push({ kind: 'tracking_conflict', objectKey: row.object_key, sha256: row.sha256 });
    } else if (!tracked) {
      expected.set(row.object_key, { sha256: row.sha256, byteLength: row.byte_length });
    }
  }
  if (expected.size > MAX_STORAGE_AUDIT_OBJECTS) throw new DomainError('limit_exceeded');

  const objects: R2Object[] = [];
  try {
    let cursor: string | undefined;
    do {
      const page = await bucket.list({ prefix: `entities/${entity}/sources/`, cursor, limit: 1000,
        include: ['httpMetadata', 'customMetadata'] });
      objects.push(...page.objects);
      if (objects.length > MAX_STORAGE_AUDIT_OBJECTS) throw new DomainError('limit_exceeded');
      if (!page.truncated) break;
      if (!page.cursor || page.cursor === cursor) throw new DomainError('storage_error');
      cursor = page.cursor;
    } while (true);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError('storage_error');
  }

  const present = new Set<string>();
  let contentChecked = 0;
  for (const listed of objects) {
    const tracked = expected.get(listed.key);
    if (!tracked) {
      const suffix = listed.key.slice(`entities/${entity}/sources/`.length);
      findings.push({ kind: 'unexpected_object', objectKey: listed.key,
        sha256: /^[0-9a-f]{64}$/.test(suffix) ? suffix : null });
      continue;
    }
    let observed = listed;
    if (verifyBytes) {
      try {
        const object = await bucket.get(listed.key);
        if (!object) {
          findings.push({ kind: 'object_changed_during_scan', objectKey: listed.key, sha256: tracked.sha256 });
          continue;
        }
        observed = object;
        contentChecked += 1;
        if ((await sha256(new Uint8Array(await object.arrayBuffer()))).hex !== tracked.sha256) {
          findings.push({ kind: 'hash_mismatch', objectKey: listed.key, sha256: tracked.sha256 });
        }
      } catch { throw new DomainError('storage_error'); }
    }
    present.add(listed.key);
    if (observed.size !== tracked.byteLength) {
      findings.push({ kind: 'size_mismatch', objectKey: listed.key, sha256: tracked.sha256 });
    }
    if (observed.httpMetadata?.contentType !== 'application/xml' || observed.customMetadata?.sha256 !== tracked.sha256
      || observed.customMetadata?.format !== 'wedge-source-v1') {
      findings.push({ kind: 'metadata_mismatch', objectKey: listed.key, sha256: tracked.sha256 });
    }
  }
  for (const row of sources) {
    if (row.state === 'stored' && typeof row.object_key === 'string' && !present.has(row.object_key)) {
      findings.push({ kind: 'missing_object', objectKey: row.object_key, sha256: row.sha256 as string });
    }
  }
  findings.sort((a, b) => a.kind < b.kind ? -1 : a.kind > b.kind ? 1
    : a.objectKey < b.objectKey ? -1 : a.objectKey > b.objectKey ? 1 : 0);
  const stillAuthorized = await queryFirst(db, db.prepare(`SELECT e.id FROM financial_entities e
    WHERE e.id = ? AND ${permitted}`).bind(entity, entity, user));
  if (!stillAuthorized) throw new DomainError('not_found');
  const pendingObjects = new Set(pending.map(row => row.object_key)).size;
  const pendingWork = pendingObjects > 0 || entityRow.state === 'deleting';
  return {
    formatVersion: 1,
    entity: { id: entity, state: entityRow.state as string },
    mode: verifyBytes ? 'content' : 'metadata',
    status: findings.length ? 'inconsistent' : pendingWork ? 'pending' : 'consistent',
    counts: { sourceObjects: sources.length, pendingObjects, bucketObjects: objects.length, contentChecked },
    findings,
  };
}
