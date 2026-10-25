ALTER TABLE `sessions` ADD COLUMN `completion_key` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_completion_key_unique` ON `sessions` (`completion_key`);