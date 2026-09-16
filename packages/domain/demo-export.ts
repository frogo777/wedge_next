import { DomainError, eraseEntity, recordSource, type DeletionRegistry, type Identity } from './repository.ts';

type Row = Record<string, string | number | null>;
export type DemoSource = Readonly<{ id: string; xml: string }>;

function userId(identity: Identity) {
  const value = identity?.userId;
  if (typeof value !== 'string' || !value.trim() || value.length > 256) {
    throw new DomainError('invalid_input');
  }
  return value;
}

async function linkedEntity(db: D1Database, user: string) {
  try {
    const row = await db.prepare(`SELECT d.entity_id,
      CASE WHEN m.entity_id IS NULL THEN 0 ELSE 1 END AS authorized
      FROM demo_source_entities d
      LEFT JOIN entity_memberships m ON m.entity_id = d.entity_id
        AND m.user_id = d.user_id AND m.role = 'owner'
      WHERE d.user_id = ? LIMIT 1`).bind(user).first<Row>();
    if (row && row.authorized !== 1) throw new DomainError('storage_error');
    return row;
  } catch {
    throw new DomainError('storage_error');
  }
}

export async function findDemoSourceEntity(db: D1Database, identity: Identity) {
  const row = await linkedEntity(db, userId(identity));
  return typeof row?.entity_id === 'string' ? row.entity_id : null;
}

export async function ensureDemoSourceEntity(db: D1Database, identity: Identity) {
  const user = userId(identity);
  const existing = await linkedEntity(db, user);
  if (typeof existing?.entity_id === 'string') return existing.entity_id;

  const entityId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  try {
    const results = await db.batch<Row>([
      db.prepare(`INSERT INTO financial_entities (id, created_at)
        SELECT ?, ? WHERE NOT EXISTS (
          SELECT 1 FROM demo_source_entities WHERE user_id = ?
        )`).bind(entityId, createdAt, user),
      db.prepare(`INSERT INTO entity_memberships (entity_id, user_id, role)
        SELECT id, ?, 'owner' FROM financial_entities WHERE id = ?`).bind(user, entityId),
      db.prepare(`INSERT INTO audit_events (entity_id, event_id, kind, actor_id, occurred_at)
        SELECT id, 'entity_created', 'entity_created', ?, ?
        FROM financial_entities WHERE id = ?`).bind(user, createdAt, entityId),
      db.prepare(`INSERT INTO demo_source_entities (user_id, entity_id, created_at)
        SELECT ?, id, ? FROM financial_entities WHERE id = ?
        ON CONFLICT(user_id) DO NOTHING`).bind(user, createdAt, entityId),
      db.prepare(`SELECT d.entity_id FROM demo_source_entities d
        JOIN entity_memberships m ON m.entity_id = d.entity_id
          AND m.user_id = d.user_id AND m.role = 'owner'
        WHERE d.user_id = ? LIMIT 1`).bind(user),
    ]);
    const row = results[4].results[0];
    if (typeof row?.entity_id !== 'string') throw new DomainError('storage_error');
    return row.entity_id;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError('storage_error');
  }
}

export async function storeDemoSources(db: D1Database, bucket: R2Bucket,
  identity: Identity, sources: readonly DemoSource[]) {
  const entityId = await ensureDemoSourceEntity(db, identity);
  const encoder = new TextEncoder();
  for (const source of sources) {
    if (!/^[a-z0-9_]{1,40}$/.test(source.id) || typeof source.xml !== 'string') {
      throw new DomainError('invalid_input');
    }
    await recordSource(db, bucket, identity, entityId, `demo_v1_${source.id}`, encoder.encode(source.xml));
  }
  return entityId;
}

export async function eraseDemoSourceEntity(db: D1Database, bucket: R2Bucket | undefined,
  identity: Identity, deletionRegistry?: DeletionRegistry) {
  const user = userId(identity);
  const row = await linkedEntity(db, user);
  if (typeof row?.entity_id !== 'string') return false;
  if (!bucket) throw new DomainError('storage_error');
  await eraseEntity(db, bucket, identity, row.entity_id, deletionRegistry);
  return true;
}
