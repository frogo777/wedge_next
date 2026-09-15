import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, primaryKey, foreignKey, check } from 'drizzle-orm/sqlite-core';

// Preparatory domain; no application route writes here yet. See ADR 0001.
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
