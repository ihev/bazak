CREATE TABLE `messages` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`content` text NOT NULL,
	`request_id` text,
	`reply_to_id` text,
	`product_groups` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `messages_id_unique` ON `messages` (`id`);--> statement-breakpoint
CREATE INDEX `messages_conversation_created_idx` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `messages_request_idx` ON `messages` (`conversation_id`,`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `messages_reply_idx` ON `messages` (`reply_to_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `messages_one_pending_idx` ON `messages` (`conversation_id`) WHERE "messages"."status" = 'pending';--> statement-breakpoint
ALTER TABLE `conversations` ADD `search_state` text DEFAULT '[]' NOT NULL;