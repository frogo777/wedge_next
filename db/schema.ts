import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const demoProgress = sqliteTable('demo_progress', {
  userId: text('user_id').primaryKey().notNull(),
  stage: text('stage').notNull(),
  resolved: text('resolved').notNull(),
  version: integer('version').notNull(),
  documents: text('documents').notNull().default('[]'),
  collections: text('collections').notNull().default('[]'),
  decisions: text('decisions').notNull().default('[]'),
  revision: text('revision').notNull().default('legacy'),
  updatedAt: text('updated_at').notNull(),
});
