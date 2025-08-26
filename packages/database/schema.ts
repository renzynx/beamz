import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const user = sqliteTable(
	"user",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		email: text("email").notNull().unique(),
		emailVerified: integer("email_verified", { mode: "boolean" })
			.$defaultFn(() => !1)
			.notNull(),
		image: text("image"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$defaultFn(() => new Date())
			.notNull(),
		role: text("role"),
		banned: integer("banned", { mode: "boolean" }),
		banReason: text("ban_reason"),
		banExpires: integer("ban_expires", { mode: "timestamp" }),
		quota: integer("quota").notNull().default(0),
		usedQuota: integer("used_quota").notNull().default(0),
		apiKey: text("api_key").notNull().unique(),
	},
	(table) => [index("user_email_idx").on(table.email)],
);

export const session = sqliteTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
		token: text("token").notNull().unique(),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		impersonatedBy: text("impersonated_by"),
	},
	(table) => [
		index("session_user_id_idx").on(table.userId),
		index("session_token_idx").on(table.token),
	],
);

export const account = sqliteTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: integer("access_token_expires_at", {
			mode: "timestamp",
		}),
		refreshTokenExpiresAt: integer("refresh_token_expires_at", {
			mode: "timestamp",
		}),
		scope: text("scope"),
		password: text("password"),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
	},
	(table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = sqliteTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
			() => /* @__PURE__ */ new Date(),
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
			() => /* @__PURE__ */ new Date(),
		),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const files = sqliteTable(
	"files",
	{
		id: text("id").primaryKey(),
		key: text("key").notNull().unique(),
		originalName: text("original_name").notNull(),
		size: integer("size").notNull(),
		mimeType: text("mime_type").notNull(),
		metadata: text("metadata"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
			() => /* @__PURE__ */ new Date(),
		),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$defaultFn(() => /* @__PURE__ */ new Date())
			.$onUpdate(() => /* @__PURE__ */ new Date()),
		expiresAt: integer("expires_at", { mode: "timestamp" }),
	},
	(table) => [index("files_key_idx").on(table.key)],
);

export const settings = sqliteTable("settings", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	appName: text("app_name").notNull().default("Beam"),
	cdnUrl: text("cdn_url"),
	enableSignUp: integer("enable_sign_up", { mode: "boolean" })
		.notNull()
		.default(true),
	chunkSize: integer("chunk_size")
		.notNull()
		.default(1024 * 1024 * 25), // 25mb
	maxFileSize: integer("max_file_size")
		.notNull()
		.default(1024 * 1024 * 100), // 100mb
	blackListedExtensions: text("blacklisted_extensions"), // should be an array
	expiredFilesCleanupSchedule: text("expired_files_cleanup_schedule").default(
		"0 2 * * *",
	), // Daily at 2 AM
	completedJobsCleanupSchedule: text("completed_jobs_cleanup_schedule").default(
		"0 3 * * *",
	), // Daily at 3 AM
	tempCleanupSchedule: text("temp_cleanup_schedule").default("*/30 * * * *"), // Every 30 minutes
	cronEnabled: integer("cron_enabled", { mode: "boolean" })
		.notNull()
		.default(true),
	cronLogLevel: text("cron_log_level").default("info"),
	cronTimezone: text("cron_timezone").default("UTC"),
});

export const jobs = sqliteTable(
	"jobs",
	{
		id: text("id").primaryKey(),
		queue: text("queue").notNull(),
		payload: text("payload").notNull(),
		status: text("status").notNull().default("pending"),
		attempts: integer("attempts").notNull().default(0),
		maxAttempts: integer("max_attempts").notNull().default(3),
		error: text("error"),
		createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
			() => new Date(),
		),
		processAt: integer("process_at", { mode: "timestamp" }).$defaultFn(
			() => new Date(),
		), // When to process this job (for delays/retries)
		processedAt: integer("processed_at", { mode: "timestamp" }),
		completedAt: integer("completed_at", { mode: "timestamp" }),
	},
	(table) => [
		index("jobs_queue_status_idx").on(table.queue, table.status),
		index("jobs_process_at_idx").on(table.processAt),
	],
);

export const userRelations = relations(user, ({ many }) => ({
	files: many(files),
}));

export const fileRelations = relations(files, ({ one }) => ({
	user: one(user, {
		fields: [files.userId],
		references: [user.id],
	}),
}));
