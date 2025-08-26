import { and, count, db, eq, files, jobs, lte } from "@beam/database";
import { promises as fs } from "fs";
import superjson from "superjson";
import { z } from "zod";
import { Logger } from "./logger";
import { deleteThumbnails, generateThumbnail } from "./thumbnail";

const logger = new Logger();

const thumbnailJobSchema = z.object({
	fileId: z.string(),
	actualFilename: z.string(), // The actual filename with extension on disk
	mimeType: z.string(),
	originalName: z.string(),
});

const diskCleanupJobSchema = z.object({
	filePaths: z.array(z.string()), // Array of file paths to delete
	description: z.string(), // Description for logging
});

type ThumbnailJob = z.infer<typeof thumbnailJobSchema>;
type DiskCleanupJob = z.infer<typeof diskCleanupJobSchema>;

// Generate unique job ID
function generateJobId(): string {
	return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Queue a job
async function enqueueJob<T>(
	queue: string,
	payload: T,
	maxAttempts = 3,
	delayMs = 0,
): Promise<string> {
	const jobId = generateJobId();
	const processAt = new Date(Date.now() + delayMs);

	logger.debug(`Enqueueing job ${jobId} to ${queue} with payload:`, payload);

	await db.insert(jobs).values({
		id: jobId,
		queue,
		payload: superjson.stringify(payload),
		maxAttempts,
		processAt,
	});

	return jobId;
}

// Get next job from queue
async function getNextJob(queue: string): Promise<{
	id: string;
	payload: string;
	attempts: number;
	maxAttempts: number;
} | null> {
	const now = new Date();

	// Get the next available job
	const [job] = await db
		.select()
		.from(jobs)
		.where(
			and(
				eq(jobs.queue, queue),
				eq(jobs.status, "pending"),
				lte(jobs.processAt, now),
			),
		)
		.orderBy(jobs.processAt)
		.limit(1);

	if (!job) return null;

	// Mark as processing
	await db
		.update(jobs)
		.set({
			status: "processing",
			processedAt: now,
		})
		.where(eq(jobs.id, job.id));

	return {
		id: job.id,
		payload: job.payload,
		attempts: job.attempts,
		maxAttempts: job.maxAttempts,
	};
}

// Mark job as completed
async function completeJob(jobId: string): Promise<void> {
	await db
		.update(jobs)
		.set({
			status: "completed",
			completedAt: new Date(),
		})
		.where(eq(jobs.id, jobId));
}

// Mark job as failed
async function failJob(
	jobId: string,
	error: string,
	attempts: number,
	maxAttempts: number,
): Promise<void> {
	if (attempts < maxAttempts) {
		// Retry with exponential backoff
		const delayMs = Math.min(1000 * 2 ** attempts, 60000); // Max 1 minute
		const processAt = new Date(Date.now() + delayMs);

		await db
			.update(jobs)
			.set({
				status: "pending",
				attempts: attempts + 1,
				error,
				processAt,
			})
			.where(eq(jobs.id, jobId));
	} else {
		// Max attempts reached
		await db
			.update(jobs)
			.set({
				status: "failed",
				error,
				completedAt: new Date(),
			})
			.where(eq(jobs.id, jobId));
	}
}

// Worker class
class QueueWorker<T> {
	private isRunning = false;
	private interval: Timer | null = null;

	constructor(
		private queueName: string,
		private processor: (data: T) => Promise<void>,
		private schema: z.ZodSchema<T>,
		private options: {
			concurrency?: number;
			pollInterval?: number;
		} = {},
	) {
		this.start();
	}

	start(): void {
		if (this.isRunning) return;

		this.isRunning = true;
		const pollInterval = this.options.pollInterval || 1000;

		this.interval = setInterval(() => {
			this.processJobs();
		}, pollInterval);

		logger.info(`Started ${this.queueName} worker`);
	}

	stop(): void {
		this.isRunning = false;
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
		logger.info(`Stopped ${this.queueName} worker`);
	}

	private async processJobs(): Promise<void> {
		if (!this.isRunning) return;

		try {
			const job = await getNextJob(this.queueName);
			if (!job) return;

			try {
				logger.debug(`Processing job ${job.id} with raw payload:`, job.payload);
				const parsedPayload = superjson.parse<T>(job.payload);
				logger.debug("Parsed payload:", parsedPayload);
				const validatedData = this.schema.parse(parsedPayload);

				// Process the job
				await this.processor(validatedData);

				// Mark as completed
				await completeJob(job.id);
				logger.info(`[${job.id}] Job completed successfully`);
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				logger.error(`[${job.id}] Job failed:`, errorMessage);

				await failJob(job.id, errorMessage, job.attempts, job.maxAttempts);
			}
		} catch (error) {
			logger.error(`Error processing ${this.queueName} jobs:`, error);
		}
	}
}

const thumbnailWorker = new QueueWorker(
	"thumbnail_jobs",
	async (data: ThumbnailJob) => {
		logger.info(`Processing thumbnail for file: ${data.actualFilename}`);

		const result = await generateThumbnail(
			data.actualFilename,
			data.mimeType,
			data.originalName,
		);

		// Update database with thumbnail paths
		await db
			.update(files)
			.set({
				metadata: superjson.stringify(result.metadata),
			})
			.where(eq(files.id, data.fileId));

		logger.info(`Thumbnail generated successfully for: ${data.actualFilename}`);
	},
	thumbnailJobSchema,
	{ concurrency: 1, pollInterval: 1000 },
);

const diskCleanupWorker = new QueueWorker(
	"disk_cleanup_jobs",
	async (data: DiskCleanupJob) => {
		logger.info(`Processing disk cleanup: ${data.description}`);

		const deleteResults = await Promise.allSettled(
			data.filePaths.map(async (filePath) => {
				try {
					await fs.unlink(filePath);
					logger.info(`Deleted file: ${filePath}`);
					return { success: true, path: filePath };
				} catch (error) {
					logger.warn(`Failed to delete file: ${filePath}`, error);
					return { success: false, path: filePath, error };
				}
			}),
		);

		const failedDeletions = deleteResults.filter(
			(result) => result.status === "rejected" || !result.value?.success,
		).length;

		if (failedDeletions > 0) {
			logger.warn(
				`Disk cleanup completed with ${failedDeletions} failed deletions out of ${data.filePaths.length} total files`,
			);
		} else {
			logger.info(
				`Disk cleanup completed successfully: deleted ${data.filePaths.length} files`,
			);
		}
	},
	diskCleanupJobSchema,
	{ concurrency: 2, pollInterval: 500 },
);

export async function queueThumbnailGeneration(
	fileId: string,
	actualFilename: string,
	mimeType: string,
	originalName: string,
): Promise<string> {
	const jobId = await enqueueJob("thumbnail_jobs", {
		fileId,
		actualFilename,
		mimeType,
		originalName,
	});
	logger.info(
		`Queued thumbnail generation for: ${actualFilename} (job ${jobId})`,
	);
	return jobId;
}

export async function queueDiskCleanup(
	filePaths: string[],
	description: string,
): Promise<void> {
	if (filePaths.length === 0) return;

	await enqueueJob("disk_cleanup_jobs", {
		filePaths,
		description,
	});
	logger.info(
		`Queued disk cleanup for ${filePaths.length} files: ${description}`,
	);
}

export async function cleanupFileThumbnails(
	actualFilename: string,
): Promise<void> {
	try {
		await deleteThumbnails(actualFilename);
	} catch (error) {
		logger.error(`Failed to cleanup thumbnails for ${actualFilename}:`, error);
	}
}

// Queue status functions
export async function getQueueStatus(queueName: string): Promise<{
	pending: number;
	processing: number;
	completed: number;
	failed: number;
}> {
	const [pendingCount] = await db
		.select({ count: count() })
		.from(jobs)
		.where(and(eq(jobs.queue, queueName), eq(jobs.status, "pending")));

	const [processingCount] = await db
		.select({ count: count() })
		.from(jobs)
		.where(and(eq(jobs.queue, queueName), eq(jobs.status, "processing")));

	const [completedCount] = await db
		.select({ count: count() })
		.from(jobs)
		.where(and(eq(jobs.queue, queueName), eq(jobs.status, "completed")));

	const [failedCount] = await db
		.select({ count: count() })
		.from(jobs)
		.where(and(eq(jobs.queue, queueName), eq(jobs.status, "failed")));

	return {
		pending: pendingCount?.count || 0,
		processing: processingCount?.count || 0,
		completed: completedCount?.count || 0,
		failed: failedCount?.count || 0,
	};
}

export { thumbnailWorker, diskCleanupWorker };
