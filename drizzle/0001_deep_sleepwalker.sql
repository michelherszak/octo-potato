CREATE TABLE `analytics_page_views` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visitor_id` text NOT NULL,
	`path` text NOT NULL,
	`title` text NOT NULL,
	`visited_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analytics_page_views_visitor` ON `analytics_page_views` (`visitor_id`);--> statement-breakpoint
CREATE INDEX `analytics_page_views_visited_at` ON `analytics_page_views` (`visited_at`);--> statement-breakpoint
CREATE TABLE `analytics_visitors` (
	`visitor_id` text PRIMARY KEY NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analytics_visitors_last_seen` ON `analytics_visitors` (`last_seen_at`);