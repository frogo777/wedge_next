// Server-only entry point. identity MUST come from authenticated server context.
// Not connected to HTTP routes while storage/retention gates in ADR 0001 remain open.
export type Identity = Readonly<{ userId: string }>;
type Row = Record<string, string | number | null>;
type Failure = 'invalid_input' | 'not_found' | 'command_conflict' | 'storage_error';
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
async function transact(db: D1Database, statements: D1PreparedStatement[]) {
  try { return await db.batch<Row>(statements); }
  catch { throw new DomainError('storage_error'); } // Do not expose SQL/provider errors.
}
const permitted = `EXISTS (SELECT 1 FROM entity_memberships m WHERE m.entity_id = ? AND m.user_id = ? AND m.role = 'owner')`;

export async function createEntity(db: D1Database, identity: Identity) {
  const user = actor(identity), id = crypto.randomUUID(), at = new Date().toISOString();
  await transact(db, [
    db.prepare('INSERT INTO financial_entities (id, created_at) VALUES (?, ?)').bind(id, at),
    db.prepare("INSERT INTO entity_memberships (entity_id, user_id, role) VALUES (?, ?, 'owner')").bind(id, user),
    db.prepare("INSERT INTO audit_events (entity_id, event_id, kind, actor_id, occurred_at) VALUES (?, 'entity_created', 'entity_created', ?, ?)").bind(id, user, at),
  ]);
  return { id, createdAt: at };
}

export async function recordSource(db: D1Database, identity: Identity, entityId: string, commandId: string, bytes: Uint8Array) {
  const user = actor(identity), entity = key(entityId), command = key(commandId);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > 131072) throw new DomainError('invalid_input');
  const snapshot = new Uint8Array(bytes); // Caller mutation during digest cannot change the receipt.
  const digest = await crypto.subtle.digest('SHA-256', snapshot);
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  const at = new Date().toISOString();
  const results = await transact(db, [
    // A conflicting command must not even create an orphan source. D1.batch serializes this check and all writes.
    db.prepare(`INSERT INTO source_artifacts (entity_id, sha256, byte_length, created_at)
      SELECT ?, ?, ?, ? WHERE ${permitted}
      AND NOT EXISTS (SELECT 1 FROM import_receipts WHERE entity_id = ? AND command_id = ? AND sha256 <> ?)
      ON CONFLICT(entity_id, sha256) DO NOTHING`).bind(entity, hash, snapshot.byteLength, at, entity, user, entity, command, hash),
    db.prepare(`INSERT INTO import_receipts (entity_id, command_id, sha256, actor_id, received_at)
      SELECT ?, ?, ?, ?, ? WHERE ${permitted}
      AND EXISTS (SELECT 1 FROM source_artifacts WHERE entity_id = ? AND sha256 = ?)
      ON CONFLICT(entity_id, command_id) DO NOTHING`).bind(entity, command, hash, user, at, entity, user, entity, hash),
    db.prepare(`INSERT INTO audit_events (entity_id, event_id, kind, command_id, actor_id, occurred_at)
      SELECT entity_id, 'source:' || command_id, 'source_received', command_id, actor_id, received_at
      FROM import_receipts WHERE entity_id = ? AND command_id = ? AND sha256 = ? AND ${permitted}
      ON CONFLICT(entity_id, event_id) DO NOTHING`).bind(entity, command, hash, entity, user),
    db.prepare(`SELECT * FROM import_receipts WHERE entity_id = ? AND command_id = ? AND ${permitted}`).bind(entity, command, entity, user),
  ]);
  const receipt = results[3].results[0];
  if (!receipt) throw new DomainError('not_found');
  if (receipt.sha256 !== hash) throw new DomainError('command_conflict');
  return receipt;
}

export async function exportEntity(db: D1Database, identity: Identity, entityId: string) {
  const user = actor(identity), entity = key(entityId);
  const results = await transact(db, [
    db.prepare(`SELECT * FROM financial_entities WHERE id = ? AND ${permitted}`).bind(entity, entity, user),
    db.prepare(`SELECT * FROM entity_memberships WHERE entity_id = ? AND ${permitted} ORDER BY user_id`).bind(entity, entity, user),
    db.prepare(`SELECT * FROM source_artifacts WHERE entity_id = ? AND ${permitted} ORDER BY sha256`).bind(entity, entity, user),
    db.prepare(`SELECT * FROM import_receipts WHERE entity_id = ? AND ${permitted} ORDER BY command_id`).bind(entity, entity, user),
    db.prepare(`SELECT * FROM audit_events WHERE entity_id = ? AND ${permitted} ORDER BY event_id`).bind(entity, entity, user),
  ]);
  if (!results[0].results[0]) throw new DomainError('not_found');
  return { formatVersion: 1, entity: results[0].results[0], memberships: results[1].results,
    sources: results[2].results, receipts: results[3].results, audit: results[4].results };
}

export async function eraseEntity(db: D1Database, identity: Identity, entityId: string) {
  const user = actor(identity), entity = key(entityId);
  const [result] = await transact(db, [db.prepare(`DELETE FROM financial_entities WHERE id = ? AND ${permitted}`).bind(entity, entity, user)]);
  if (result.meta.changes === 0) throw new DomainError('not_found');
}
