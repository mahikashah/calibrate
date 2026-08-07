ALTER TABLE `questions` ADD COLUMN `answer_choices` text;--> statement-breakpoint
ALTER TABLE `questions` ADD COLUMN `source_excerpt` text;--> statement-breakpoint
ALTER TABLE `questions` ADD COLUMN `status` text NOT NULL DEFAULT 'generated';
