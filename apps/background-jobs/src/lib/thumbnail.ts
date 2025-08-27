import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { basename, extname, join } from "node:path";
import * as ffmpeg from "@ffmpeg-installer/ffmpeg";
import {
	PREVIEW_CONFIG,
	SUPPORTED_AUDIO_TYPES,
	SUPPORTED_IMAGE_TYPES,
	SUPPORTED_VIDEO_TYPES,
	THUMBNAIL_CONFIG,
	UPLOAD_DIR,
} from "./constants";
import { Logger } from "./logger";
import type { FileMetadata } from "./types";

const logger = new Logger();

const ffmpegPath = ffmpeg.path;

export async function generateImageThumbnail(
	inputPath: string,
	outputPath: string,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const args = [
			"-i",
			inputPath,
			"-vf",
			`scale=${THUMBNAIL_CONFIG.width}:${THUMBNAIL_CONFIG.height}:force_original_aspect_ratio=decrease,pad=${THUMBNAIL_CONFIG.width}:${THUMBNAIL_CONFIG.height}:(ow-iw)/2:(oh-ih)/2`,
			"-frames:v",
			"1",
			"-f",
			"webp",
			"-quality",
			THUMBNAIL_CONFIG.quality.toString(),
			"-y", // Overwrite output file
			outputPath,
		];

		const process = spawn(ffmpegPath, args);

		let stderr = "";
		process.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		process.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
			}
		});

		process.on("error", (error) => {
			reject(new Error(`Failed to spawn FFmpeg: ${error}`));
		});
	});
}

export async function generateVideoThumbnail(
	inputPath: string,
	outputPath: string,
	timeOffset = "00:00:01",
): Promise<void> {
	return new Promise((resolve, reject) => {
		const args = [
			"-i",
			inputPath,
			"-ss",
			timeOffset,
			"-vframes",
			"1",
			"-f",
			"webp",
			"-vf",
			`scale=${THUMBNAIL_CONFIG.width}:${THUMBNAIL_CONFIG.height}:force_original_aspect_ratio=increase,crop=${THUMBNAIL_CONFIG.width}:${THUMBNAIL_CONFIG.height}`,
			"-quality",
			THUMBNAIL_CONFIG.quality.toString(),
			"-y", // Overwrite output file
			outputPath,
		];

		const process = spawn(ffmpegPath, args);

		let stderr = "";
		process.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		process.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
			}
		});

		process.on("error", (error) => {
			reject(new Error(`Failed to spawn FFmpeg: ${error}`));
		});
	});
}

export async function generateVideoPreview(
	inputPath: string,
	outputPath: string,
	duration: number = PREVIEW_CONFIG.duration,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const args = [
			"-i",
			inputPath,
			"-t",
			duration.toString(),
			"-vf",
			`scale=${PREVIEW_CONFIG.width}:${PREVIEW_CONFIG.height}:force_original_aspect_ratio=decrease,pad=${PREVIEW_CONFIG.width}:${PREVIEW_CONFIG.height}:(ow-iw)/2:(oh-ih)/2`,
			"-c:v",
			"libvpx-vp9",
			"-crf",
			"30",
			"-b:v",
			"0",
			"-b:a",
			"128k",
			"-c:a",
			"libopus",
			"-r",
			PREVIEW_CONFIG.fps.toString(),
			"-f",
			"webm",
			"-y",
			outputPath,
		];

		const process = spawn(ffmpegPath, args);

		let stderr = "";
		process.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		process.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
			}
		});

		process.on("error", (error) => {
			reject(new Error(`Failed to spawn FFmpeg: ${error}`));
		});
	});
}

export async function extractAlbumCoverDirectly(
	inputPath: string,
	outputPath: string,
): Promise<boolean> {
	return new Promise((resolve) => {
		const args = [
			"-i",
			inputPath,
			"-an", // No audio
			"-vf",
			`scale=${THUMBNAIL_CONFIG.width}:${THUMBNAIL_CONFIG.height}:force_original_aspect_ratio=decrease,pad=${THUMBNAIL_CONFIG.width}:${THUMBNAIL_CONFIG.height}:(ow-iw)/2:(oh-ih)/2`,
			"-vframes",
			"1",
			"-f",
			"webp",
			"-quality",
			THUMBNAIL_CONFIG.quality.toString(),
			"-y",
			outputPath,
		];

		const process = spawn(ffmpegPath, args);

		let stderr = "";

		process.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		process.on("close", (code) => {
			resolve(code === 0);
		});

		process.on("error", () => {
			resolve(false);
		});
	});
}

export async function generateAudioThumbnail(
	inputPath: string,
	outputPath: string,
): Promise<void> {
	return new Promise((resolve, reject) => {
		// Generate waveform data
		const waveformArgs = [
			"-i",
			inputPath,
			"-filter_complex",
			`[0:a]aformat=channel_layouts=mono,compand,showwavespic=s=${THUMBNAIL_CONFIG.width}x${THUMBNAIL_CONFIG.height}:colors=#1e40af[v]`,
			"-map",
			"[v]",
			"-frames:v",
			"1",
			"-f",
			"webp",
			"-quality",
			THUMBNAIL_CONFIG.quality.toString(),
			"-y",
			outputPath,
		];

		const process = spawn(ffmpegPath, waveformArgs);

		let stderr = "";
		process.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		process.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
			}
		});

		process.on("error", (error) => {
			reject(new Error(`Failed to spawn FFmpeg: ${error}`));
		});
	});
}

export async function generateThumbnail(
	actualFilename: string, // The actual filename with extension
	mimeType: string,
	originalName: string,
): Promise<{
	thumbnailPath: string;
	previewPath?: string;
	metadata: FileMetadata;
}> {
	const inputPath = join(UPLOAD_DIR, actualFilename);
	const baseName = basename(actualFilename, extname(actualFilename)); // Get slug from filename
	const thumbnailPath = join(UPLOAD_DIR, `${baseName}_thumb.webp`);

	let previewPath: string | undefined;
	const metadata: FileMetadata = {
		thumbnail: null,
		preview: null,
	};

	try {
		// Check if input file exists
		await fs.access(inputPath);

		if (SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
			// Generate image thumbnail
			await generateImageThumbnail(inputPath, thumbnailPath);

			metadata.thumbnail = `${baseName}_thumb.webp`;
		} else if (SUPPORTED_VIDEO_TYPES.includes(mimeType)) {
			// Generate video thumbnail and preview
			previewPath = join(UPLOAD_DIR, `${baseName}_preview.webm`);

			const thumbnailTime = "00:00:03"; // Extract thumbnail at 3 seconds

			await Promise.all([
				generateVideoThumbnail(inputPath, thumbnailPath, thumbnailTime),
				generateVideoPreview(inputPath, previewPath),
			]);

			metadata.thumbnail = `${baseName}_thumb.webp`;
			metadata.preview = `${baseName}_preview.webm`;
		} else if (SUPPORTED_AUDIO_TYPES.includes(mimeType)) {
			// Generate audio thumbnail - try album cover first, fallback to waveform
			let thumbnailType = "waveform";
			let albumCoverExtracted = false;

			// Try to extract album cover directly as WebP thumbnail
			try {
				albumCoverExtracted = await extractAlbumCoverDirectly(
					inputPath,
					thumbnailPath,
				);

				if (albumCoverExtracted) {
					// Verify the thumbnail was actually created and has content
					try {
						const stats = await fs.stat(thumbnailPath);
						if (stats.size > 0) {
							thumbnailType = "album_cover";
						} else {
							albumCoverExtracted = false;
						}
					} catch {
						albumCoverExtracted = false;
					}
				}
			} catch (error) {
				logger.warn(
					`Album cover extraction failed, falling back to waveform: ${error}`,
				);
				albumCoverExtracted = false;
			}

			// If album cover extraction failed, generate waveform
			if (!albumCoverExtracted) {
				await generateAudioThumbnail(inputPath, thumbnailPath);
			}

			metadata.thumbnail = `${baseName}_thumb.webp`;
			metadata.type = thumbnailType;

			// No audio preview created for audio files; only thumbnail is generated
		} else {
			throw new Error(`Unsupported file type: ${mimeType}`);
		}

		// Verify thumbnail was created
		await fs.access(thumbnailPath);

		return {
			thumbnailPath: metadata.thumbnail!,
			previewPath: metadata.preview || undefined,
			metadata,
		};
	} catch (error) {
		// Clean up any partially created files
		try {
			await fs.unlink(thumbnailPath).catch(() => {});
			if (previewPath) {
				await fs.unlink(previewPath).catch(() => {});
			}
		} catch (cleanupError) {
			logger.error("Failed to clean up thumbnail files:", cleanupError);
		}

		throw new Error(`Failed to generate thumbnail: ${error}`);
	}
}

export async function deleteThumbnails(actualFilename: string): Promise<void> {
	const baseName = basename(actualFilename, extname(actualFilename));
	const thumbnailPath = join(UPLOAD_DIR, `${baseName}_thumb.webp`);
	const previewPath = join(UPLOAD_DIR, `${baseName}_preview.webm`);

	try {
		await Promise.allSettled([
			fs.unlink(thumbnailPath),
			fs.unlink(previewPath),
		]);
	} catch (error) {
		logger.error("Failed to delete thumbnail files:", error);
	}
}

export function isSupportedFileType(mimeType: string): boolean {
	return (
		SUPPORTED_IMAGE_TYPES.includes(mimeType) ||
		SUPPORTED_VIDEO_TYPES.includes(mimeType) ||
		SUPPORTED_AUDIO_TYPES.includes(mimeType)
	);
}

export function getThumbnailPaths(fileKey: string) {
	const baseName = basename(fileKey, extname(fileKey));
	return {
		thumbnail: `${baseName}_thumb.webp`,
		preview: `${baseName}_preview.webm`,
	};
}
