import type { FileMetadata } from "@beam/shared";
import {
  SUPPORTED_AUDIO_TYPES,
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_VIDEO_TYPES,
  UPLOAD_DIR,
} from "@beam/shared/constants";
import * as ffmpeg from "@ffmpeg-installer/ffmpeg";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { basename, extname, join } from "node:path";
import { PREVIEW_CONFIG, THUMBNAIL_CONFIG } from "./constants";
import { Logger } from "./logger";

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
): Promise<void> {
  const videoDuration = await getVideoDuration(inputPath);

  const clipDuration = 1.0;
  const maxPreviewDuration = 4.0;
  const numClips = Math.max(
    1,
    Math.min(4, Math.floor(maxPreviewDuration / clipDuration)),
  );

  // Generate random timestamps, ensuring they don't overlap and have minimum spacing
  const timestamps: number[] = [];
  const minInterval = 8;
  const maxAttempts = 50;

  for (let i = 0; i < numClips; i++) {
    let timestamp: number;
    let attempts = 0;

    do {
      // Pick a random moment, ensuring we don't go beyond video duration
      const maxStart = Math.max(0, videoDuration - clipDuration - 1);
      timestamp = maxStart > 0 ? Math.random() * maxStart : 0;
      attempts++;

      if (attempts > maxAttempts) {
        // If we can't find a good spot, just space them evenly
        timestamp = (i * videoDuration) / numClips;
        break;
      }
    } while (
      timestamps.some((t) => Math.abs(t - timestamp) < minInterval) ||
      timestamp + clipDuration > videoDuration
    );

    timestamps.push(timestamp);
  }

  // Sort timestamps chronologically
  timestamps.sort((a, b) => a - b);

  return new Promise((resolve, reject) => {
    // Create a simpler approach: extract multiple clips and concatenate them
    const filterParts: string[] = [];

    // Create trim filters for each timestamp
    timestamps.forEach((ts, index) => {
      filterParts.push(
        `[0:v]trim=start=${ts.toFixed(2)}:duration=${clipDuration},setpts=PTS-STARTPTS,scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2[clip${index}]`,
      );
    });

    // Create concat filter
    const clipLabels = timestamps.map((_, index) => `[clip${index}]`).join("");
    filterParts.push(`${clipLabels}concat=n=${numClips}:v=1:a=0[out]`);

    const filterComplex = filterParts.join(";");

    const args = [
      "-i",
      inputPath,
      "-filter_complex",
      filterComplex,
      "-map",
      "[out]",
      "-c:v",
      "libvpx-vp9",
      "-crf",
      "40",
      "-b:v",
      "200k",
      "-maxrate",
      "300k",
      "-bufsize",
      "400k",
      "-quality",
      "realtime",
      "-speed",
      "8",
      "-tile-columns",
      "1",
      "-frame-parallel",
      "1",
      "-threads",
      "2",
      "-an", // No audio
      "-r",
      "10", // Fixed 10 FPS for hover previews
      "-f",
      PREVIEW_CONFIG.format,
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

    let _stderr = "";

    process.stderr.on("data", (data) => {
      _stderr += data.toString();
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
): Promise<{
  thumbnailPath: string | null;
  previewPath: string | null;
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

    // Clean up any existing thumbnail and preview files before generating new ones
    const potentialThumbnailPath = join(UPLOAD_DIR, `${baseName}_thumb.webp`);
    const potentialPreviewPath = join(UPLOAD_DIR, `${baseName}_preview.webm`);
    
    await Promise.allSettled([
      fs.unlink(potentialThumbnailPath).catch(() => {}), // Ignore errors if files don't exist
      fs.unlink(potentialPreviewPath).catch(() => {}),   // Ignore errors if files don't exist
    ]);

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
      thumbnailPath: metadata.thumbnail,
      previewPath: metadata.preview,
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

export async function getVideoDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const args = ["-i", inputPath, "-f", "null", "-"];

    const process = spawn(ffmpegPath, args);

    let stderr = "";
    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("close", (code) => {
      if (code === 0 || code === 1) {
        // FFmpeg returns 1 for null output but duration is in stderr
        const durationMatch = stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
        if (durationMatch) {
          const hours = Number.parseInt(durationMatch[1], 10);
          const minutes = Number.parseInt(durationMatch[2], 10);
          const seconds = Number.parseFloat(durationMatch[3]);
          const totalSeconds = hours * 3600 + minutes * 60 + seconds;
          resolve(totalSeconds);
        } else {
          reject(new Error("Could not parse video duration"));
        }
      } else {
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
      }
    });

    process.on("error", (error) => {
      reject(new Error(`Failed to spawn FFmpeg: ${error}`));
    });
  });
}
