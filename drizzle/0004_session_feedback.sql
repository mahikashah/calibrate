CREATE TABLE `session_feedback` (
  `id` text PRIMARY KEY NOT NULL,
  `session_id` text NOT NULL,
  `overall` text NOT NULL,
  `calm_wired` integer DEFAULT 50 NOT NULL,
  `reasons` text DEFAULT '[]' NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_feedback_session_id_unique` ON `session_feedback` (`session_id`);