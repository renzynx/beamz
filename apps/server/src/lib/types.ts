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

export interface EnqueueThumbnailPayload {
  fileId: string;
  actualFilename: string;
  mimeType: string;
  originalName?: string;
}

export interface EnqueueThumbnailResponse {
  success: boolean;
  jobId?: string;
  message?: string;
  error?: string;
}

export interface EnqueueDiskCleanupPayload {
  filePaths: string[];
  description?: string;
}

export interface EnqueueDiskCleanupResponse {
  success: boolean;
  message?: string;
  count?: number;
  error?: string;
}

export interface ControlResponse {
  success: boolean;
  message?: string;
  error?: string;
}
