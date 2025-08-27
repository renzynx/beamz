import superjson from "superjson";

export interface FileMetadata {
  thumbnail: string | null;
  preview: string | null;
  type?: string; // For audio thumbnails (album_cover, waveform)
}

export function parseFileMetadata(
  metadataString: string | null,
): FileMetadata | null {
  if (!metadataString) return null;

  try {
    return superjson.parse<FileMetadata>(metadataString);
  } catch (error) {
    console.error("Failed to parse file metadata:", error);
    return null;
  }
}
