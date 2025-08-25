CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`original_name` text NOT NULL,
	`size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`metadata` text,
	`user_id` text NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_key_unique` ON `files` (`key`);--> statement-breakpoint
CREATE INDEX `files_key_idx` ON `files` (`key`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`queue` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`error` text,
	`created_at` integer,
	`process_at` integer,
	`processed_at` integer,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `jobs_queue_status_idx` ON `jobs` (`queue`,`status`);--> statement-breakpoint
CREATE INDEX `jobs_process_at_idx` ON `jobs` (`process_at`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_token_idx` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_name` text DEFAULT 'Beam' NOT NULL,
	`enable_sign_up` integer DEFAULT true NOT NULL,
	`chunk_size` integer DEFAULT 26214400 NOT NULL,
	`max_file_size` integer DEFAULT 104857600 NOT NULL,
	`blacklisted_extensions` text,
	`job_cleanup_schedule` text DEFAULT '0 2 * * *',
	`temp_cleanup_schedule` text DEFAULT '*/30 * * * *',
	`cron_enabled` integer DEFAULT true NOT NULL,
	`cron_log_level` text DEFAULT 'info',
	`cron_timezone` text DEFAULT 'UTC'
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`role` text,
	`banned` integer,
	`ban_reason` text,
	`ban_expires` integer,
	`quota` integer DEFAULT 0 NOT NULL,
	`used_quota` integer DEFAULT 0 NOT NULL,
	`api_key` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_api_key_unique` ON `user` (`api_key`);--> statement-breakpoint
CREATE INDEX `user_email_idx` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);