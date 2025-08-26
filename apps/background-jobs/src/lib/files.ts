import { db, files, lte } from "@beam/database";
import { promises as fs } from "fs";
import { extname, join } from "path";
import { TEMP_DIR, UPLOAD_DIR } from "./constants";
import { Logger } from "./logger";
import { queueDiskCleanup } from "./queue";

const logger = new Logger();

export async function cleanupOrphanedTempFiles(): Promise<void> {
	try {
		const tempFiles = await fs.readdir(TEMP_DIR);

		const now = Date.now();
		const cutoffMs = 24 * 60 * 60 * 1000; // 24 hours

		logger.info(`Found ${tempFiles.length} temp files, checking age...`);

		const pathsToDelete: string[] = [];

		const checkPromises = tempFiles.map(async (file) => {
			const filePath = join(TEMP_DIR, file);
			try {
				const stats = await fs.stat(filePath);
				const ageMs = now - (stats.mtimeMs || stats.mtime.getTime());

				if (ageMs >= cutoffMs) {
					pathsToDelete.push(filePath);
					logger.info(`Queued ${file} for deletion (older than 24h)`);
				} else {
					const hours = (ageMs / (1000 * 60 * 60)).toFixed(2);
					logger.debug(`Skipping ${file} — age ${hours}h < 24h`);
				}
			} catch (error) {
				logger.warn(`Failed to stat temp file ${file}:`, error);
			}
		});

		await Promise.allSettled(checkPromises);

		if (pathsToDelete.length > 0) {
			// Enqueue a disk cleanup job for the expired temp files
			await queueDiskCleanup(
				pathsToDelete,
				`Orphaned temp files cleanup (${pathsToDelete.length} files)`,
			);

			logger.info(
				`Enqueued cleanup for ${pathsToDelete.length} orphaned temp files in ${TEMP_DIR}`,
			);
		} else {
			logger.info(`No orphaned temp files older than 24h found in ${TEMP_DIR}`);
		}
	} catch (error) {
		logger.error("Failed to cleanup orphaned temp files:", error);
	}
}

export async function cleanupExpiredFiles(): Promise<number> {
	try {
		const now = new Date();

		const expiredFiles = await db
			.select()
			.from(files)
			.where(lte(files.expiresAt, now));

		if (!expiredFiles || expiredFiles.length === 0) {
			logger.info("No expired files found for deletion");
			return 0;
		}

		const filePaths = expiredFiles.map((f) => {
			const ext = extname(f.originalName || "") || "";
			return join(UPLOAD_DIR, `${f.key}${ext}`);
		});

		// Enqueue disk cleanup job
		await queueDiskCleanup(
			filePaths,
			`Expired files cleanup (${expiredFiles.length} files)`,
		);

		logger.info(`Enqueued cleanup for ${expiredFiles.length} expired files`);

		return expiredFiles.length;
	} catch (error) {
		logger.error("Failed to enqueue expired files for deletion:", error);
		return 0;
	}
}
