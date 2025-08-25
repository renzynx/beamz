import { basename, extname } from "path";
import {
  SUPPORTED_AUDIO_TYPES,
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_VIDEO_TYPES,
} from "./constants";

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
