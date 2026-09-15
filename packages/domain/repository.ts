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
