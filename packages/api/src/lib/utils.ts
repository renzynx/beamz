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

export function getStoredName(slug: string, originalFilename: string): string {
  const ext = getFileExtension(originalFilename);
  return `${slug}${ext}`;
}

export function getFileExtension(filename: string): string {
  return extname(filename);
}

export function formatFileSize(size: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;

  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }

  return `${size.toFixed(2)} ${units[i]}`;
}

export function generateUserAvatar(email: string): string {
  return `https://www.gravatar.com/avatar/${createHash("md5").update(email).digest("hex")}?d=identicon`;
}
