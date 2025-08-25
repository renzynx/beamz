export interface FileMetadata {
  thumbnail: string | null;
  preview: string | null;
  type?: string; // For audio thumbnails (e.g., 'waveform')
}

export interface UploadMetadata {
  chunks: Set<number>; // Track chunk numbers (not offsets)
  size: number;
  finished: boolean;
  filename: string;
  totalChunks: number;
  userId: string;
  chunkSize: number; // Track chunk size for validation
}
