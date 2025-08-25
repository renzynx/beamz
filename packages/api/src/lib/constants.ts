import path from "path";

export const BASE_URL = process.env.BASE_URL || "http://localhost:3333";
export const SECRET = process.env.SECRET;
export const UPLOAD_DIR = path.resolve(process.cwd(), "..", "..", "uploads");
export const TEMP_DIR = path.resolve(UPLOAD_DIR, "tmp");

export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/tiff",
  "image/bmp",
  "image/svg+xml",
];

export const SUPPORTED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/avi",
  "video/mov",
  "video/mkv",
  "video/flv",
  "video/wmv",
  "video/m4v",
  "video/3gp",
  "video/quicktime",
];

export const SUPPORTED_AUDIO_TYPES = [
  "audio/mp3",
  "audio/mpeg",
  "audio/wav",
  "audio/flac",
  "audio/aac",
  "audio/ogg",
  "audio/m4a",
  "audio/wma",
  "audio/opus",
];
