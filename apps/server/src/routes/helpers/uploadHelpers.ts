import { join } from "node:path";
import SuperJSON from "superjson";
import z from "zod";
import { TEMP_DIR, UPLOAD_DIR } from "@/lib/constants";
import { SETTINGS } from "@/lib/settings";
import type { UploadMetadata } from "@/lib/types";
import { getFileExtension } from "@/lib/utils";

export const getPartPath = (id: string) => join(TEMP_DIR, `${id}.part`);
export const getFinalPath = (slug: string, originalFilename: string) =>
  join(UPLOAD_DIR, `${slug}${getFileExtension(originalFilename)}`);

export const registry = new Map<string, UploadMetadata>();

// Helper function to validate all chunks are present
export const validateAllChunksReceived = (
  uploadMeta: UploadMetadata,
): boolean => {
  if (uploadMeta.chunks.size !== uploadMeta.totalChunks) {
    return false;
  }

  // Check that we have chunks 0 through totalChunks-1
  for (let i = 0; i < uploadMeta.totalChunks; i++) {
    if (!uploadMeta.chunks.has(i)) {
      return false;
    }
  }

  return true;
};

// Helper function to get missing chunks
export const getMissingChunks = (uploadMeta: UploadMetadata): number[] => {
  const missing: number[] = [];
  for (let i = 0; i < uploadMeta.totalChunks; i++) {
    if (!uploadMeta.chunks.has(i)) {
      missing.push(i);
    }
  }
  return missing;
};

export const initSchema = z.object({
  filename: z.string().min(2).max(255),
  size: z.number().min(1),
});

// Helper function to check if file extension is blacklisted
export const isFileExtensionBlacklisted = (filename: string): boolean => {
  if (!SETTINGS.blackListedExtensions) return false;

  try {
    const blacklistedExts: string[] = SuperJSON.parse(
      SETTINGS.blackListedExtensions,
    );
    const fileExt = getFileExtension(filename);
    return blacklistedExts.some((ext) => ext.toLowerCase() === fileExt);
  } catch (error) {
    console.error("Error parsing blacklisted extensions:", error);
    return false;
  }
};

// Helper function to check if detected file type extension is blacklisted
export const isDetectedFileTypeBlacklisted = (detectedExt: string): boolean => {
  if (!SETTINGS.blackListedExtensions || !detectedExt) return false;

  try {
    const blacklistedExts: string[] = SuperJSON.parse(
      SETTINGS.blackListedExtensions,
    );
    const normalizedExt = detectedExt.startsWith(".")
      ? detectedExt.toLowerCase()
      : `.${detectedExt.toLowerCase()}`;
    return blacklistedExts.some((ext) => ext.toLowerCase() === normalizedExt);
  } catch (error) {
    console.error("Error parsing blacklisted extensions:", error);
    return false;
  }
};
