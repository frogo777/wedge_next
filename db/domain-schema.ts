import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, primaryKey, foreignKey, check, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Preparatory domain. Only the closed synthetic demo catalog writes here;
// user-provided fiscal documents remain disabled. See ADR 0001 and ADR 0002.
export const entities = sqliteTable('financial_entities', {
  id: text('id').primaryKey().notNull(),
  createdAt: text('created_at').notNull(),
});
export const memberships = sqliteTable('entity_memberships', {
  entityId: text('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  role: text('role').notNull().default('owner'),
}, t => [primaryKey({ columns: [t.entityId, t.userId] }), check('membership_role', sql`${t.role} = 'owner'`)]);
export const sourceArtifacts = sqliteTable('source_artifacts', {
  entityId: text('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  sha256: text('sha256').notNull(),
  byteLength: integer('byte_length').notNull(),
  storageState: text('storage_state').notNull().default('metadata_only'),
  createdAt: text('created_at').notNull(),
}, t => [
  primaryKey({ columns: [t.entityId, t.sha256] }),
  check('source_hash', sql`length(${t.sha256}) = 64 AND ${t.sha256} NOT GLOB '*[^0-9a-f]*'`),
  check('source_size', sql`${t.byteLength} BETWEEN 1 AND 131072`),
  check('source_storage', sql`${t.storageState} = 'metadata_only'`),
]);
export const sourceObjects = sqliteTable('source_objects', {
  entityId: text('entity_id').notNull(),
  sha256: text('sha256').notNull(),
  objectKey: text('object_key').notNull(),
  mediaType: text('media_type').notNull().default('application/xml'),
  state: text('state').notNull().default('stored'),
  createdAt: text('created_at').notNull(),
}, t => [
  primaryKey({ columns: [t.entityId, t.sha256] }),
  foreignKey({ columns: [t.entityId, t.sha256], foreignColumns: [sourceArtifacts.entityId, sourceArtifacts.sha256] }).onDelete('cascade'),
  check('object_key', sql`${t.objectKey} = 'entities/' || ${t.entityId} || '/sources/' || ${t.sha256}`),
  check('object_media', sql`${t.mediaType} = 'application/xml'`),
  check('object_state', sql`${t.state} IN ('stored', 'deleting')`),
]);
export const sourceUploadAttempts = sqliteTable('source_upload_attempts', {
  entityId: text('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  commandId: text('command_id').notNull(),
  sha256: text('sha256').notNull(),
  byteLength: integer('byte_length').notNull(),
  objectKey: text('object_key').notNull(),
  actorId: text('actor_id').notNull(),
  startedAt: text('started_at').notNull(),
}, t => [
  primaryKey({ columns: [t.entityId, t.commandId] }),
  check('upload_hash', sql`length(${t.sha256}) = 64 AND ${t.sha256} NOT GLOB '*[^0-9a-f]*'`),
  check('upload_size', sql`${t.byteLength} BETWEEN 1 AND 131072`),
  check('upload_key', sql`${t.objectKey} = 'entities/' || ${t.entityId} || '/sources/' || ${t.sha256}`),
]);
export const entityDeletions = sqliteTable('entity_deletions', {
  entityId: text('entity_id').primaryKey().notNull().references(() => entities.id, { onDelete: 'cascade' }),
  actorId: text('actor_id').notNull(),
  startedAt: text('started_at').notNull(),
});
export const importReceipts = sqliteTable('import_receipts', {
  entityId: text('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  commandId: text('command_id').notNull(),
  sha256: text('sha256').notNull(),
  actorId: text('actor_id').notNull(),
  receivedAt: text('received_at').notNull(),
}, t => [
  primaryKey({ columns: [t.entityId, t.commandId] }),
  foreignKey({ columns: [t.entityId, t.sha256], foreignColumns: [sourceArtifacts.entityId, sourceArtifacts.sha256] }),
]);
export const auditEvents = sqliteTable('audit_events', {
  entityId: text('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  eventId: text('event_id').notNull(),
  kind: text('kind').notNull(),
  commandId: text('command_id'),
  actorId: text('actor_id').notNull(),
  occurredAt: text('occurred_at').notNull(),
}, t => [
  primaryKey({ columns: [t.entityId, t.eventId] }),
  foreignKey({ columns: [t.entityId, t.commandId], foreignColumns: [importReceipts.entityId, importReceipts.commandId] }),
  check('audit_kind', sql`(${t.kind} = 'entity_created' AND ${t.commandId} IS NULL) OR (${t.kind} = 'source_received' AND ${t.commandId} IS NOT NULL)`),
]);

// Synthetic-only bridge between the current demo account and the preparatory
// financial domain. It lets the founder exercise private R2 export without
// accepting user-provided fiscal documents.
export const demoSourceEntities = sqliteTable('demo_source_entities', {
  userId: text('user_id').primaryKey().notNull(),
  entityId: text('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
}, t => [uniqueIndex('uq_demo_source_entities_entity').on(t.entityId)]);
