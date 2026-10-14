CREATE TABLE `article_versions` (
	`publication_id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`revision` integer NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_revision` ON `article_versions` (`slug`,`revision`);--> statement-breakpoint
CREATE TABLE `articles` (
	`slug` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`publication_id` text NOT NULL,
	`payload` text NOT NULL
);
