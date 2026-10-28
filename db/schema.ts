import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
export const articles = sqliteTable('articles', {
  slug: text('slug').primaryKey(), revision: integer('revision').notNull(),
  publicationId: text('publication_id').notNull(), payload: text('payload').notNull(),
});
export const articleVersions = sqliteTable('article_versions', {
  publicationId: text('publication_id').primaryKey(), slug: text('slug').notNull(),
  revision: integer('revision').notNull(), payload: text('payload').notNull(),
}, table => [uniqueIndex('article_revision').on(table.slug, table.revision)]);

export const analyticsVisitors = sqliteTable('analytics_visitors', {
  visitorId: text('visitor_id').primaryKey(),
  firstSeenAt: integer('first_seen_at').notNull(),
  lastSeenAt: integer('last_seen_at').notNull(),
}, table => [index('analytics_visitors_last_seen').on(table.lastSeenAt)]);

export const analyticsPageViews = sqliteTable('analytics_page_views', {
  id: integer('id').primaryKey({autoIncrement:true}),
  visitorId: text('visitor_id').notNull(),
  path: text('path').notNull(),
  title: text('title').notNull(),
  visitedAt: integer('visited_at').notNull(),
}, table => [
  index('analytics_page_views_visitor').on(table.visitorId),
  index('analytics_page_views_visited_at').on(table.visitedAt),
]);
