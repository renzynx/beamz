import superjson from "superjson";

// Define the metadata types (matching the backend types)
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

export function hasThumbnail(metadata: FileMetadata | null): boolean {
	return metadata?.thumbnail !== null && metadata?.thumbnail !== undefined;
}

export function hasPreview(metadata: FileMetadata | null): boolean {
	return metadata?.preview !== null && metadata?.preview !== undefined;
}

export function getThumbnailUrl(metadata: FileMetadata | null): string | null {
	if (!hasThumbnail(metadata) || !metadata?.thumbnail) return null;
	return `/api/f/${metadata.thumbnail}`;
}

export function getPreviewUrl(metadata: FileMetadata | null): string | null {
	if (!hasPreview(metadata) || !metadata?.preview) return null;
	return `/api/f/${metadata.preview}`;
}
