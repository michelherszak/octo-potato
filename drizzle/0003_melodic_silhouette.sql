CREATE TABLE `auth_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`event` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_audit_log_user` ON `auth_audit_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `auth_audit_log_created_at` ON `auth_audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `company_follows` (
	`user_id` text NOT NULL,
	`ticker` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `ticker`)
);
--> statement-breakpoint
CREATE INDEX `company_follows_user` ON `company_follows` (`user_id`);--> statement-breakpoint
CREATE INDEX `company_follows_ticker` ON `company_follows` (`ticker`);--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar_path` text,
	`role` text DEFAULT 'user' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`email_verified_at` integer NOT NULL,
	`terms_accepted_at` integer,
	`terms_version` text,
	`privacy_accepted_at` integer,
	`privacy_version` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_login_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_profiles_email` ON `user_profiles` (`email`);--> statement-breakpoint
CREATE INDEX `user_profiles_role_status` ON `user_profiles` (`role`,`status`);--> statement-breakpoint
CREATE INDEX `user_profiles_last_login` ON `user_profiles` (`last_login_at`);