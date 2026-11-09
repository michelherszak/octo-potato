CREATE TABLE `company_news` (
	`ticker` text PRIMARY KEY NOT NULL,
	`publication_id` text NOT NULL,
	`payload` text NOT NULL,
	`published_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `company_news_publication` ON `company_news` (`publication_id`);