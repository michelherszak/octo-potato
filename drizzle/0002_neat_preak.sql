CREATE TABLE `account_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`subscriber_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`subscriber_id`) REFERENCES `subscribers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_expiry` ON `account_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `email_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`subscriber_id` text NOT NULL,
	`article_slug` text NOT NULL,
	`publication_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer DEFAULT 0 NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`claim_id` text,
	`message` text,
	`sent_at` integer,
	`first_attempt_at` integer,
	FOREIGN KEY (`subscriber_id`) REFERENCES `subscribers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`article_slug`) REFERENCES `articles`(`slug`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`publication_id`) REFERENCES `article_versions`(`publication_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `delivery_pending` ON `email_deliveries` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `subscriber_publication_email` ON `email_deliveries` (`subscriber_id`,`publication_id`);--> statement-breakpoint
CREATE TABLE `email_login_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`subscriber_id` text NOT NULL,
	`requested_ticker` text,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`subscriber_id`) REFERENCES `subscribers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `login_token_expiry` ON `email_login_tokens` (`expires_at`);--> statement-breakpoint
CREATE TABLE `email_send_budget` (
	`key` text PRIMARY KEY NOT NULL,
	`day` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_budget_day` ON `email_send_budget` (`day`);--> statement-breakpoint
CREATE TABLE `signup_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_subscriptions` (
	`subscriber_id` text NOT NULL,
	`ticker` text NOT NULL,
	PRIMARY KEY(`subscriber_id`, `ticker`),
	FOREIGN KEY (`subscriber_id`) REFERENCES `subscribers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `subscribers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL,
	`verified_at` integer,
	`general_news` integer DEFAULT 0 NOT NULL,
	`consent_at` integer,
	`consent_version` text,
	`preferences_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriber_email` ON `subscribers` (`email`);