import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const articles = sqliteTable('articles', {
  slug: text('slug').primaryKey(), revision: integer('revision').notNull(),
  publicationId: text('publication_id').notNull(), payload: text('payload').notNull(),
});
export const articleVersions = sqliteTable('article_versions', {
  publicationId: text('publication_id').primaryKey(), slug: text('slug').notNull(),
  revision: integer('revision').notNull(), payload: text('payload').notNull(),
}, table => [uniqueIndex('article_revision').on(table.slug, table.revision)]);
