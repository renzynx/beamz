import { createHash, randomBytes } from "crypto";
import { extname } from "path";

export function generateFileSlug(): string {
  return randomBytes(8)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .substring(0, 11);
}

export function getStoredName(
  slug: string,
  originalFilename: string,
  variant?: string
): string {
  const ext = getFileExtension(originalFilename);
  return variant
    ? `${slug}_${variant}.${variant === "thumbnail" ? "webp" : "webm"}`
    : `${slug}${ext}`;
}

export function getFileExtension(filename: string): string {
  return extname(filename);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function generateUserAvatar(email: string): string {
  return `https://www.gravatar.com/avatar/${createHash("md5").update(email).digest("hex")}?d=identicon`;
}
