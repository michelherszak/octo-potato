import { sqliteTable, text, integer, primaryKey, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
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

export const subscribers = sqliteTable('subscribers', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  createdAt: integer('created_at').notNull(),
  verifiedAt: integer('verified_at'),
  generalNews: integer('general_news').notNull().default(0),
  consentAt: integer('consent_at'),
  consentVersion: text('consent_version'),
  preferencesAt: integer('preferences_at'),
}, table => [uniqueIndex('subscriber_email').on(table.email)]);

export const stockSubscriptions = sqliteTable('stock_subscriptions', {
  subscriberId: text('subscriber_id').notNull().references(() => subscribers.id, {onDelete: 'cascade'}),
  ticker: text('ticker').notNull(),
}, table => [primaryKey({columns: [table.subscriberId, table.ticker]})]);

export const emailLoginTokens = sqliteTable('email_login_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  subscriberId: text('subscriber_id').notNull().references(() => subscribers.id, {onDelete: 'cascade'}),
  requestedTicker: text('requested_ticker'),
  expiresAt: integer('expires_at').notNull(),
}, table => [index('login_token_expiry').on(table.expiresAt)]);

export const accountSessions = sqliteTable('account_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  subscriberId: text('subscriber_id').notNull().references(() => subscribers.id, {onDelete: 'cascade'}),
  expiresAt: integer('expires_at').notNull(),
}, table => [index('session_expiry').on(table.expiresAt)]);

export const signupRateLimits = sqliteTable('signup_rate_limits', {
  key: text('key').primaryKey(),
  hits: integer('hits').notNull(),
  expiresAt: integer('expires_at').notNull(),
});

export const emailDeliveries = sqliteTable('email_deliveries', {
  id: text('id').primaryKey(),
  subscriberId: text('subscriber_id').notNull().references(() => subscribers.id, {onDelete: 'cascade'}),
  articleSlug: text('article_slug').notNull().references(() => articles.slug),
  publicationId: text('publication_id').notNull().references(() => articleVersions.publicationId),
  createdAt: integer('created_at').notNull(),
  status: text('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: integer('next_attempt_at').notNull().default(0),
  leaseUntil: integer('lease_until').notNull().default(0),
  claimId: text('claim_id'),
  message: text('message'),
  sentAt: integer('sent_at'),
  firstAttemptAt: integer('first_attempt_at'),
}, table => [index('delivery_pending').on(table.status, table.nextAttemptAt), uniqueIndex('subscriber_publication_email').on(table.subscriberId, table.publicationId)]);

export const emailSendBudget = sqliteTable('email_send_budget', {
  key: text('key').primaryKey(),
  day: integer('day').notNull(),
}, table => [index('email_budget_day').on(table.day)]);

export const userProfiles = sqliteTable('user_profiles', {
  userId: text('user_id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  avatarPath: text('avatar_path'),
  role: text('role').notNull().default('user'),
  status: text('status').notNull().default('active'),
  emailVerifiedAt: integer('email_verified_at').notNull(),
  termsAcceptedAt: integer('terms_accepted_at'),
  termsVersion: text('terms_version'),
  privacyAcceptedAt: integer('privacy_accepted_at'),
  privacyVersion: text('privacy_version'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  lastLoginAt: integer('last_login_at').notNull(),
  deletedAt: integer('deleted_at'),
}, table => [
  uniqueIndex('user_profiles_email').on(table.email),
  index('user_profiles_role_status').on(table.role, table.status),
  index('user_profiles_last_login').on(table.lastLoginAt),
]);

export const authAuditLog = sqliteTable('auth_audit_log', {
  id: integer('id').primaryKey({autoIncrement:true}),
  userId: text('user_id'),
  event: text('event').notNull(),
  detail: text('detail').notNull().default(''),
  createdAt: integer('created_at').notNull(),
}, table => [
  index('auth_audit_log_user').on(table.userId),
  index('auth_audit_log_created_at').on(table.createdAt),
]);

export const companyFollows = sqliteTable('company_follows', {
  userId: text('user_id').notNull(),
  ticker: text('ticker').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [
  primaryKey({columns:[table.userId,table.ticker]}),
  index('company_follows_user').on(table.userId),
  index('company_follows_ticker').on(table.ticker),
]);

// Ein freigegebener Meldungs-Digest je Unternehmen; ein neuer ersetzt den vorherigen.
export const companyNews = sqliteTable('company_news', {
  ticker: text('ticker').primaryKey(),
  publicationId: text('publication_id').notNull(),
  payload: text('payload').notNull(),
  publishedAt: integer('published_at').notNull(),
}, table => [uniqueIndex('company_news_publication').on(table.publicationId)]);
